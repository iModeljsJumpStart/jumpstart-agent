import * as sgMail from "@sendgrid/mail";
import * as React from "react";
import * as ReactDOMServer from "react-dom/server";
import { AgentConfig } from "./AgentConfig";
import { ChangedElementReport } from "./FlagLongLeadItems";

const indentStyle = { margin: "0 0 0 1em", fontSize: "13pt" };

function LongLeadItemChangeReport(props: ChangedElementReport) {
  const h2Style = { margin: 0, fontWeight: 500 };
  return (
    <div style={{ fontFamily: "'Calibri', sans-serif", fontSize: "10pt" }}>
      <h1>⚠️ Changes to Long Lead Item(s) detected!</h1>
      <h2 style={h2Style}>Change Date/Time:<b> {props.date}</b></h2>
      <h2 style={h2Style}>Change Description:<b> {props.description}</b></h2>
      <br />
      <h2 style={h2Style}>Element(s) Changed:</h2>
      {
        ...Object.entries(props.sections).map(([elementName, instances]) => <div key={elementName} style={indentStyle}>
          <b>{elementName}</b>
          {...Object.entries(instances).map(([name, details]) => <InstanceChangeSection key={name} name={name} details={details} />)}
        </div>)
      }
    </div>
  );
}

function InstanceChangeSection({ name, details }: any) {
  const changeColors: any = { Update: "blue", Insert: "green", Delete: "red" };
  return (
    <div style={indentStyle}>
      <b style={{ color: changeColors[details.changeType] }}>{details.changeType.toUpperCase()} </b>
      {name}
      <ul style={{ margin: "0" }}>
        {Object.entries(details.propertyChanges).map(([pname, props]) => <PropertyChangeSection key={pname} name={pname} {...props} />)}
      </ul>
    </div>
  );
}

function PropertyChangeSection({ name, oldValue, newValue }: any) {
  const oldSpan = (oldValue === undefined) ? "" : <span style={{ textDecoration: "line-through", color: "red" }}>{oldValue}</span>;
  const newSpan = (newValue === undefined) ? "" : <span style={{ color: "green" }}>{newValue}</span>;
  const arrow = (oldSpan && newSpan) ? <b> 🡆 </b> : "";
  return (
    <li>
      <b>{name}: </b>{oldSpan}{arrow}{newSpan}
    </li>
  );
}

export async function sendEmail(config: AgentConfig, report: ChangedElementReport) {
  // using SendGrid's Node.js Library
  // https://github.com/sendgrid/sendgrid-nodejs
  sgMail.setApiKey(config.SENDGRID_API_KEY);
  const msg = {
    to: config.SENDGRID_RECIPIENT_EMAIL,
    from: config.SENDGRID_SENDER_EMAIL,
    subject: "[MY-IMODEL-AGENT] Long Lead Item(s) Changed",
    html: ReactDOMServer.renderToStaticMarkup(<LongLeadItemChangeReport {...report} />),
    // text: JSON.stringify(report, undefined, 2),
  };
  await sgMail.send(msg);
}
