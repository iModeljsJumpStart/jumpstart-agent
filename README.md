# iModel.js JumpStart Agent

## About this Repository

This repository contains all the source code for the agent we implemented in the _"Creating an agent to monitor and report iModel changes"_ session from [Day 2 of the iModel.js Jump Start Developer Workshop](https://gateway.on24.com/wcc/eh/2028083/lp/2420629/day-2%3A-imodel.js-jump-start-developer-workshop/)

To build and run this locally, you will need to clone this repo, `npm install`, setup the sample data, and setup your configuration.

## Sample Data

We've also included the IFC sample data we used in today's session.  If you want to use the same data, you can create an iModel, and the use the [iTwin Synchronizer](https://www.bentley.com/en/products/product-line/digital-twins/itwin-synchronizer) to synchronize the three files in the `ifc-files\base\` directory to import the initial dataset.

> When creating your iModel, be sure to set correct project extents if you want to be able to visualize anything in Design Review.  
> We recommend using the following location in Boston, MA (centered roughly at `42°21'19.8"N 71°03'31.9"W`):
>
> ![project-extents](https://i.ibb.co/kMqgSTq/extents-1.png)

### Sample Changes

To generate changesets, you're free to change the included IFC files however you like, but to make things easy we've included some of the example changes used in the JumpStart session.  To add these changes, simply copy the files from `ifc-files\changed\` to `ifc-files\base\` and re-run your synchronization in the iTwin Synchronizer.  You can also keep reverting that change and re-applying it to generate future changesets.

## Configuration

The provided agent app _almost_ works right out of the box, but you'll need to configure it with your project, iModel, OIDC, and SendGrid information.
To do this, just create a `.env` file at the project root with the following:

```ini
###############################################################################
# This file contains secrets - don't commit or share it!
###############################################################################

# Specify an iModel
CONTEXT_ID=
IMODEL_ID=

# OIDC configuration
#   Don't forget to add <CLIENT_ID>@apps.imsoidc.bentley.com to your CONNECT project too!
CLIENT_ID=
CLIENT_SECRET=

# SendGrid configuration
SENDGRID_API_KEY=
SENDGRID_SENDER_EMAIL=
SENDGRID_RECIPIENT_EMAIL=
```

Your `CLIENT_ID` and `CLIENT_SECRET` should both come from the iModel.js [registration dashboard](https://www.imodeljs.org/getting-started/registration-dashboard/) - be sure to create an "Agent" app!

In this demo, we chose to use SendGrid as a cloud SMTP provider - they provide an easy-to-use Node.js API for sending emails, and support sending up to 100 emails a day for free.  You can follow [this guide to setup SendGrid](https://sendgrid.com/docs/for-developers/sending-email/quickstart-nodejs/).

## Building and running the agent

Once you've created your iModel and .env file, you can build this agent via `npm run build`.

Or - even better - start TypeScript in watch/incremental rebuild mode: `npm run build -- --watch`

### Running agent locally

To run the agent, you can simply do `npm start` (or `node .` if you're in the project root dir).  This will continuously poll for new changesets pushed to the iModelHub.

For testing, it can often also be useful to skip the event listening and just run against a specific changeset.  To do that, either run `npm start -- --latest` to use the latest changeset, or `npm start -- --changeset=<CHANGESETID>` to use any specific changeset.

