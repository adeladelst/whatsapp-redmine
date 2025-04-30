const express = require("express");
const body_parser = require("body-parser");
const axios = require("axios");
const {
  createIssue,
  getIssuesByPhoneNumber,
  deleteIssue,
  checkIfTrackerExists,
  getProjectsByPhoneNumber,
  createProject,
  deleteIssuesByPhoneNumber,
  getProjectById,
  deleteProject,
  getAllPriorites,
  getUserProjectsByToken,
  getUserTokenByPhoneNumber,
  createIssueFromUser,
  getIssuesByToken,
  getAllTrackers,
} = require("./redmine");

require("dotenv").config();

const app = express().use(body_parser.json());

let token = process.env.TOKEN; // API token
const mytoken = process.env.MYTOKEN; // personal token

// Emojis pour les statuts
const emojies = {
    new: "🆕",
    "in progress": "⌛",
    resolved: "✅",
    closed: "⛔",
    blocked: "⛔",
    feedback: "🔄",
  };
  
  const statusMapping = {
    "Pris en charge": "in progress",
    "En cours de traitement": "in progress",
    "En cours de test": "feedback",
    "En cours de validation": "feedback",
    "Résolu": "resolved",
    "Bloqué": "blocked",
    "Clôturé": "closed"
  };
  
  const doubleHorizontalLine = String.fromCharCode(0x2e3a);

// User session data
const userSessions = {};

app.listen(process.env.PORT || 3000, () => {
  console.log("webhook is listening");
});

// to verify the callback url from dashboard side - cloud api side
app.get("/webhook", (req, res) => {
    let mode = req.query["hub.mode"];
    let challenge = req.query["hub.challenge"];
    let token = req.query["hub.verify_token"];
    if (mode && token) {
      if (mode === "subscribe" && token === mytoken) {
        res.status(200).send(challenge);
      } else {
        res.status(403);
      }
    }
  });

// Main webhook handler
app.post("/webhook", async (req, res) => {
    let body_param = req.body;
    if (body_param.object) {
      if (
        body_param.entry &&
        body_param.entry[0].changes &&
        body_param.entry[0].changes[0].value.messages &&
        body_param.entry[0].changes[0].value.messages[0]
      ) {
        let phon_no_id = body_param.entry[0].changes[0].value.metadata.phone_number_id;
        let from = body_param.entry[0].changes[0].value.messages[0].from;
        let msg_body = body_param.entry[0].changes[0].value.messages[0].text.body;
        let user_name = body_param.entry[0].changes[0].value.contacts[0].profile.name;
        
        console.log("From:", from, "\nMessage:", msg_body, "\nUsername:", user_name);
  
        // Initialize user session if not present
        if (!userSessions[from]) {
          userSessions[from] = {
            state: "welcome",
            issueSubject: "",
            issueDescription: "",
            issuePriority: "",
            selectedProjectId: "",
            selectedTrackerId: "",
            userName: user_name
          };
          
          // Send welcome message
          await sendWelcomeMessage(from, phon_no_id, user_name);
          res.sendStatus(200);
          return;
        }
  
        // Get Redmine tokens
        const admin_token = process.env.ADMIN_TOKEN;
        const user_token = await getUserTokenByPhoneNumber(from, user_name);
        
        if (!user_token) {
          await sendMessage(
            from,
            phon_no_id,
            "⚠️ Votre numéro de téléphone n'est pas enregistré. Veuillez l'ajouter à votre compte Redmine."
          );
          res.sendStatus(200);
          return;
        }
  
        // Process user input based on current state
        try {
          await handleUserMessage(from, phon_no_id, msg_body, user_token, user_name);
        } catch (error) {
          console.error("Error handling user message:", error);
          await sendMessage(
            from,
            phon_no_id,
            "⚠️ Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer plus tard."
          );
          // Reset session on error
          userSessions[from] = {
            state: "welcome",
            issueSubject: "",
            issueDescription: "",
            issuePriority: "",
            selectedProjectId: "",
            selectedTrackerId: "",
            userName: user_name
          };
        }
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  });
  
  async function handleUserMessage(from, phon_no_id, msg_body, user_token, user_name) {
    const session = userSessions[from];
    
    switch (session.state) {
      case "welcome":
        await handleWelcomeState(from, phon_no_id, msg_body, user_token, user_name);
        break;
        
      case "awaiting_project_selection":
        await handleProjectSelection(from, phon_no_id, msg_body, user_token);
        break;
        
      case "awaiting_action_choice":
        await handleActionChoice(from, phon_no_id, msg_body, user_token);
        break;
        
      case "awaiting_tracker_selection":
        await handleTrackerSelection(from, phon_no_id, msg_body);
        break;
        
      case "awaiting_subject":
        await handleSubjectInput(from, phon_no_id, msg_body);
        break;
        
      case "awaiting_description":
        await handleDescriptionInput(from, phon_no_id, msg_body);
        break;
        
      case "awaiting_priority":
        await handlePriorityInput(from, phon_no_id, msg_body);
        break;
        
      case "confirm_creation":
        await handleCreationConfirmation(from, phon_no_id, msg_body, user_token, user_name);
        break;
        
      case "awaiting_ticket_selection":
        await handleTicketSelection(from, phon_no_id, msg_body, user_token);
        break;
        
      default:
        await sendMessage(
          from,
          phon_no_id,
          "Commande non reconnue. Veuillez réessayer."
        );
        session.state = "welcome";
        await sendWelcomeMessage(from, phon_no_id, user_name);
    }
  }
  
  async function sendWelcomeMessage(from, phon_no_id, user_name) {
    const message = `Bonjour M. ${user_name.split(' ')[0]}\n\n` +
      "Saisissez, à partir de la liste, le numéro du projet auquel vous souhaitez créer ou consulter un ticket";
    
    const projects = await getUserProjectsByToken(await getUserTokenByPhoneNumber(from, user_name));
    
    if (projects.length === 0) {
      await sendMessage(
        from,
        phon_no_id,
        "Aucun projet trouvé pour votre compte. Veuillez contacter l'administrateur."
      );
      return;
    }
    
    let projectList = projects.map(p => `ID: ${p.id}, Nom: ${p.name}`).join("\n");
    await sendMessage(from, phon_no_id, `${message}\n\n${projectList}`);
    
    userSessions[from].state = "awaiting_project_selection";
  }
  
  async function handleWelcomeState(from, phon_no_id, msg_body, user_token, user_name) {
    // If user sends any message after welcome, treat as project selection
    await handleProjectSelection(from, phon_no_id, msg_body, user_token);
  }
  
  async function handleProjectSelection(from, phon_no_id, msg_body, user_token) {
    const session = userSessions[from];
    
    if (msg_body.toLowerCase() === "annuler") {
      resetSession(session);
      await sendMessage(from, phon_no_id, "Opération annulée.");
      await sendWelcomeMessage(from, phon_no_id, session.userName);
      return;
    }
    
    const projects = await getUserProjectsByToken(user_token);
    const selectedProject = projects.find(p => p.id == msg_body);
    
    if (!selectedProject) {
      await sendMessage(
        from,
        phon_no_id,
        "⚠️ Projet invalide. Veuillez sélectionner un ID de projet valide."
      );
      
      let projectList = projects.map(p => `ID: ${p.id}, Nom: ${p.name}`).join("\n");
      await sendMessage(from, phon_no_id, `Projets disponibles:\n\n${projectList}`);
      return;
    }
    
    session.selectedProjectId = msg_body;
    session.state = "awaiting_action_choice";
    
    await sendMessage(
      from,
      phon_no_id,
      "Vous souhaitez :\n1. Créer un ticket\n2. Faire le suivi d'un ticket\n\n" +
      "Répondez par le numéro correspondant à votre choix."
    );
  }
  
  async function handleActionChoice(from, phon_no_id, msg_body, user_token) {
    const session = userSessions[from];
    
    if (msg_body.toLowerCase() === "annuler") {
      resetSession(session);
      await sendMessage(from, phon_no_id, "Opération annulée.");
      await sendWelcomeMessage(from, phon_no_id, session.userName);
      return;
    }
    
    if (msg_body === "1") {
      session.state = "awaiting_tracker_selection";
      const trackers = await getAllTrackers();
      
      let trackerList = trackers.map(t => `ID: ${t.id}, Type: ${t.name}`).join("\n");
      await sendMessage(
        from,
        phon_no_id,
        "Veuillez sélectionner le type de ticket :\n\n" + trackerList
      );
    } else if (msg_body === "2") {
      session.state = "awaiting_ticket_selection";
      const issues = await getIssuesByToken(user_token, from);
      
      if (issues.length === 0) {
        await sendMessage(
          from,
          phon_no_id,
          "Aucun ticket trouvé pour ce projet."
        );
        session.state = "awaiting_action_choice";
        return;
      }
      
      let issueList = issues.map(i => 
        `ID: ${i.id}, Sujet: ${i.subject}, Statut: ${i.status.name}`
      ).join("\n");
      
      await sendMessage(
        from,
        phon_no_id,
        "Veuillez sélectionner le ticket à suivre :\n\n" + issueList
      );
    } else {
      await sendMessage(
        from,
        phon_no_id,
        "Choix invalide. Veuillez répondre par 1 ou 2."
      );
    }
  }

async function sendMessage(from, phon_no_id, message) {
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v16.0/${phon_no_id}/messages?access_token=${token}`,
      data: {
        messaging_product: "whatsapp",
        to: from,
        text: { body: message },
      },
      headers: { "Content-Type": "application/json" },
    });
  }
  
  function resetSession(session) {
    session.state = "welcome";
    session.issueSubject = "";
    session.issueDescription = "";
    session.issuePriority = "";
    session.selectedProjectId = "";
    session.selectedTrackerId = "";
  }