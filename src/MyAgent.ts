import { AgentAuthorizationClient, AzureFileHandler } from "@bentley/backend-itwin-client";
import { ChangeSetPostPushEvent, IModelHubClient, IModelHubEventType } from "@bentley/imodelhub-client";
import { ApplicationType, AuthorizedBackendRequestContext, BriefcaseDb, BriefcaseManager, IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { IModelVersion, SyncMode } from "@bentley/imodeljs-common";
import * as fs from "fs";
import * as path from "path";
import { AgentConfig } from "./AgentConfig";
import { flagLongLeadItems } from "./FlagLongLeadItems";
import { sendEmail } from "./SendEmail";

export class MyAgent {
  private readonly config: AgentConfig;
  private readonly hubClient: IModelHubClient;
  private readonly oidcClient: AgentAuthorizationClient;

  private deleteEventListener?: () => void;

  constructor(config: AgentConfig) {
    this.config = config;
    this.hubClient = new IModelHubClient(new AzureFileHandler());
    this.oidcClient = new AgentAuthorizationClient({
      clientId: config.CLIENT_ID,
      clientSecret: config.CLIENT_SECRET,
      scope: "imodelhub context-registry-service:read-only urlps-third-party",
    });
  }

  public async initialize() {
    const hostConfig = new IModelHostConfiguration();
    hostConfig.applicationType = ApplicationType.WebAgent;
    hostConfig.imodelClient = this.hubClient;
    await IModelHost.startup(hostConfig);
  }

  public async listen() {
    const ctx = await this.createContext();

    // Create iModelHub event subscription
    const eventTypes = [
      IModelHubEventType.ChangeSetPostPushEvent,
    ];

    const savedSubscriptionIdPath = path.join(__dirname, "SavedSubscriptionId");
    let subscriptionId;
    try {
      subscriptionId = fs.readFileSync(savedSubscriptionIdPath).toString("utf8");
    } catch (error) {
      console.warn("Failed to read saved iModelHub Subscription ID.  Maybe this is the first run?");
    }

    if (!subscriptionId) {
      subscriptionId = (await this.hubClient.events.subscriptions.create(ctx, this.config.IMODEL_ID, eventTypes)).wsgId;
      console.log(`Event subscription "${subscriptionId}" created in iModelHub.`);
      fs.writeFileSync(savedSubscriptionIdPath, subscriptionId, { encoding: "utf8" });
    }

    // Define event listener
    const listener = async (event: ChangeSetPostPushEvent) => {
      try {
        console.log(`Received notification that changeset "${event.changeSetId} was just posted to the Hub`);
        await this.run(IModelVersion.asOfChangeSet(event.changeSetId));
      } catch (error) {
        console.error(error);
        console.error("Failed to handle changeset event", event);
      }
    };

    // Start listening to events
    const authCallback = () => this.oidcClient.getAccessToken();
    this.deleteEventListener = this.hubClient.events.createListener(ctx, authCallback, subscriptionId, this.config.IMODEL_ID, listener);
  }

  public async run(version = IModelVersion.latest()) {
    const ctx = await this.createContext();

    // Download iModel
    const downloadOptions = { syncMode: SyncMode.FixedVersion };
    const briefcaseProps = await BriefcaseManager.download(ctx, this.config.CONTEXT_ID, this.config.IMODEL_ID, downloadOptions, version);
    ctx.enter();

    // Open iModel
    const iModel = await BriefcaseDb.open(ctx, briefcaseProps.key);
    ctx.enter();

    // TODO....
    const report = await flagLongLeadItems(ctx, iModel);
    if (report)
      await sendEmail(this.config, report);

    // Close iModel
    iModel.close();
  }

  private async createContext() {
    const token = await this.oidcClient.getAccessToken();
    const ctx = new AuthorizedBackendRequestContext(token);
    ctx.enter();
    return ctx;
  }

  public async terminate() {
    if (this.deleteEventListener) {
      this.deleteEventListener();
      this.deleteEventListener = undefined;
    }

    await IModelHost.shutdown();
  }
}
