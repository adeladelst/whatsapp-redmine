const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const { createIssue, getAllIssues, getIssueById } = require("./redmine");
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));

// Handle incoming WhatsApp messages
app.post("/whatsapp", (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();

  const incomingMessage = req.body.Body;
  const fromNumber = req.body.From;
  console.log(`Received message from ${fromNumber}: ${incomingMessage}`);

  // Create a new issue
  const issue = {
    issue: {
      project_id: 1,
      tracker_id: 4, // i set up a new tracker in redmine called Whatsapp with the id 4
      subject: incomingMessage.substring(
        "create".length,
        incomingMessage.length
      ),
      description: "phone number: " + fromNumber,
    },
  };
  if (incomingMessage === "all") {
    getAllIssues()
      .then((response) => {
        let issues = response.issues;
        if (issues.length === 0) {
          twiml.message("No issues found.");
          res.writeHead(200, { "Content-Type": "text/xml" });
          res.end(twiml.toString());
          return;
        } else {
          twiml.message("All issues:\n");
          issues.forEach((issue) => {
            twiml.message(`ID: ${issue.id}, Subject: ${issue.subject}\n`);
          });
          res.writeHead(200, { "Content-Type": "text/xml" });
          res.end(twiml.toString());
        }
      })
      .catch((error) => {
        twiml.message(`Error getting issues: ${error.message}`);
        res.writeHead(200, { "Content-Type": "text/xml" });
        res.end(twiml.toString());
      });
  } else if (incomingMessage.startsWith("create")) {
    createIssue(issue)
      .then((response) => {
        twiml.message(
          `Issue created successfully with ID: ${response.issue.id}`
        );
        res.writeHead(200, { "Content-Type": "text/xml" });
        res.end(twiml.toString());
      })
      .catch((error) => {
        twiml.message(`Error creating issue: ${error.message}`);
        res.writeHead(200, { "Content-Type": "text/xml" });
        res.end(twiml.toString());
      });
  } else {
    twiml.message("Invalid command. Please use 'create' or 'all'.");
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(twiml.toString());
  }
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
