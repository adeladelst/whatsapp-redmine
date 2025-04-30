# WHATSAPP-REDMINE INTERFACE
## Description
The WhatsApp-Redmine Interface project enables interaction with Redmine via WhatsApp. It uses a server connection to receive WhatsApp messages, process them, and perform actions in Redmine, such as creating tickets and listing existing tickets in a project.

## Twilio.js
A file responsable for the communication between our server and the twilio API. It's used for testing purposes.

## Meta.js
A file responsable for the communication between the server and the whatsapp api, it contains the webhook endpoint provided to the whatsapp api which will notify us with every new message that the test number gets.

## Redmine.js
A file responssable for all operations on the redmine tool. Creating, deleting and showing all the issues etc...


# Getting Started

This section will guide you through setting up the environment for the project, including configuring necessary environment variables.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (includes npm)
- A Meta Developer account to create a WhatsApp app and obtain the necessary tokens.


## Installation

1. **Clone the repository**:

    ```bash
    git clone https://github.com/moatazkhabbouchi/whatsapp-redmine-interface.git
    cd whatsapp-redmine-interface
    ```

2. **Install dependencies**:

    ```bash
    npm install
    ```

## Setting Up Environment Variables

You need to configure some environment variables for the project to function correctly. Create a `.env` file in the root of your project and add the following variables:

```ini
# Redmine config
# How to get API token? https://www.redmine.org/boards/2/topics/53956/
# API URL is simply the link of redmine, example https://maintenance.medianet.tn
ADMIN_TOKEN=your_redmine_api_token
API_URL=your_redmine_api_url
TRACKER_ID=your_redmine_tracker_id #Not necessary

# Facebook config
# https://developers.facebook.com/docs/whatsapp/business-management-api/get-started/
TOKEN=your_facebook_token
MY_TOKEN=your_facebook_my_token

# Twilio config (Not necessary if we're using meta)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

```

Replace your_redmine_api_token, your_redmine_api_url, your_redmine_tracker_id, your_twilio_account_sid, your_twilio_auth_token, your_facebook_token, and your_facebook_my_token with your actual values.

## Run the project
To run the project use the following command (replace with twilio if we're using twilio)
```bash
node meta
```
## Generating Documentation

To generate the documentation for `redmine.js` and automatically open the resulting HTML file, use the following command:

### macOS/Linux

```bash
jsdoc redmine.js -d ./out && open ./out/index.html
```

### Windows

```bash
jsdoc redmine.js -d ./out && start ./out/index.html
```
## Commands

### Create a new issue

**Command:**

``create ``

**Description:** Initiate issue creation process


### List all issues

**Command:**

``all``

**Description:** Lists all issues associated with the sender's phone number.

### Delete issues

**Command:**

``delete [issue_id]``

``delete all``

**Description:** Deletes the specified issue by its ID or deletes all issues associated with the sender's phone number.

**Example:**

``delete 1``

``delete all``

### Get project details

**Command:**

``project``

**Description:** Retrieves details of the project associated with the sender's phone number.

### Check issue statuses

**Command:**

``status``

**Description:** Retrieves the current status of all issues associated with the sender's phone number.

