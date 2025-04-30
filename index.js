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
    
    // Log all the requests for debugging
    console.log("Received request:", req.body);
    console.log("Request headers:", req.headers);
    console.log("Request method:", req.method);
    console.log("Request URL:", req.url);
    console.log("Request body:", req.body);
    console.log("Request query:", req.query);
    console.log("Request params:", req.params);
    console.log("Request IP:", req.ip);
    console.log("Request protocol:", req.protocol);
    console.log("Request path:", req.path);
    console.log("Request original URL:", req.originalUrl);
    console.log("Request base URL:", req.baseUrl);
    console.log("Request hostname:", req.hostname);
    console.log("Request fresh:", req.fresh);
    console.log("Request stale:", req.stale);
    console.log("Request xhr:", req.xhr);
    console.log("Request secure:", req.secure);
    
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

    // Log all the requests for debugging
    console.log("Received request:", req.body);
    console.log("Request headers:", req.headers);
    console.log("Request method:", req.method);
    console.log("Request URL:", req.url);
    console.log("Request body:", req.body);
    console.log("Request query:", req.query);
    console.log("Request params:", req.params);
    console.log("Request IP:", req.ip);
    console.log("Request protocol:", req.protocol);
    console.log("Request path:", req.path);
    console.log("Request original URL:", req.originalUrl);
    console.log("Request base URL:", req.baseUrl);
    console.log("Request hostname:", req.hostname);
    console.log("Request fresh:", req.fresh);
    console.log("Request stale:", req.stale);
    console.log("Request xhr:", req.xhr);
    console.log("Request secure:", req.secure);

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
  
async function handleTrackerSelection(from, phon_no_id, msg_body) {
    const session = userSessions[from];
  
    if (msg_body.toLowerCase() === "annuler") {
      resetSession(session);
      await sendMessage(from, phon_no_id, "Opération annulée.");
      await sendWelcomeMessage(from, phon_no_id, session.userName);
      return;
    }
  
    try {
      const trackers = await getTrackers();
      const selectedTracker = trackers.find(t => t.id == msg_body);
  
      if (!selectedTracker) {
        let trackerList = trackers.map(t => `ID: ${t.id}, Type: ${t.name}`).join("\n");
        await sendMessage(
          from,
          phon_no_id,
          "⚠️ Type de ticket invalide. Veuillez sélectionner un ID valide :\n\n" + trackerList
        );
        return;
      }
  
      session.selectedTrackerId = msg_body;
      session.state = "awaiting_subject";
      await sendMessage(
        from,
        phon_no_id,
        "Veuillez entrer le sujet du ticket (en quelques mots) :"
      );
    } catch (error) {
      console.error("Error handling tracker selection:", error);
      await sendMessage(
        from,
        phon_no_id,
        "⚠️ Une erreur est survenue lors de la sélection du type de ticket. Veuillez réessayer."
      );
      session.state = "awaiting_tracker_selection";
    }
  }
  
  async function handleSubjectInput(from, phon_no_id, msg_body) {
    const session = userSessions[from];
  
    if (msg_body.toLowerCase() === "annuler") {
      resetSession(session);
      await sendMessage(from, phon_no_id, "Opération annulée.");
      await sendWelcomeMessage(from, phon_no_id, session.userName);
      return;
    }
  
    if (msg_body.length < 5) {
      await sendMessage(
        from,
        phon_no_id,
        "⚠️ Le sujet doit contenir au moins 5 caractères. Veuillez entrer un sujet plus détaillé :"
      );
      return;
    }
  
    session.issueSubject = msg_body;
    session.state = "awaiting_description";
    await sendMessage(
      from,
      phon_no_id,
      "Veuillez entrer une description détaillée du ticket :"
    );
  }
  
  async function handleDescriptionInput(from, phon_no_id, msg_body) {
    const session = userSessions[from];
  
    if (msg_body.toLowerCase() === "annuler") {
      resetSession(session);
      await sendMessage(from, phon_no_id, "Opération annulée.");
      await sendWelcomeMessage(from, phon_no_id, session.userName);
      return;
    }
  
    if (msg_body.length < 10) {
      await sendMessage(
        from,
        phon_no_id,
        "⚠️ La description doit contenir au moins 10 caractères. Veuillez entrer une description plus détaillée :"
      );
      return;
    }
  
    session.issueDescription = msg_body;
    session.state = "awaiting_priority";
  
    try {
      const priorities = await getAllPriorites();
      let message = "Veuillez sélectionner la priorité :\n\n";
      priorities.issue_priorities.forEach((priority) => {
        message += `ID: ${priority.id} - ${priority.name}\n`;
      });
      await sendMessage(from, phon_no_id, message);
    } catch (error) {
      console.error("Error fetching priorities:", error);
      await sendMessage(
        from,
        phon_no_id,
        "⚠️ Impossible de charger les priorités. Veuillez réessayer plus tard."
      );
      session.state = "awaiting_description";
    }
  }
  
  async function handlePriorityInput(from, phon_no_id, msg_body) {
    const session = userSessions[from];
  
    if (msg_body.toLowerCase() === "annuler") {
      resetSession(session);
      await sendMessage(from, phon_no_id, "Opération annulée.");
      await sendWelcomeMessage(from, phon_no_id, session.userName);
      return;
    }
  
    try {
      const priorities = await getAllPriorites();
      const selectedPriority = priorities.issue_priorities.find(p => p.id == msg_body);
  
      if (!selectedPriority) {
        let priorityList = priorities.issue_priorities.map(p => `ID: ${p.id}, Priorité: ${p.name}`).join("\n");
        await sendMessage(
          from,
          phon_no_id,
          "⚠️ Priorité invalide. Veuillez sélectionner un ID valide :\n\n" + priorityList
        );
        return;
      }
  
      session.issuePriority = msg_body;
      session.state = "confirm_creation";
  
      const confirmationMessage = 
        `Veuillez confirmer la création du ticket avec les détails suivants :\n\n` +
        `Projet: ${session.selectedProjectId}\n` +
        `Type: ${(await getTrackers()).find(t => t.id == session.selectedTrackerId).name}\n` +
        `Sujet: ${session.issueSubject}\n` +
        `Description: ${session.issueDescription.substring(0, 50)}...\n` +
        `Priorité: ${selectedPriority.name}\n\n` +
        `Répondez "oui" pour confirmer ou "non" pour annuler.`;
  
      await sendMessage(from, phon_no_id, confirmationMessage);
    } catch (error) {
      console.error("Error handling priority input:", error);
      await sendMessage(
        from,
        phon_no_id,
        "⚠️ Une erreur est survenue lors de la sélection de la priorité. Veuillez réessayer."
      );
      session.state = "awaiting_priority";
    }
  }
  
  async function handleCreationConfirmation(from, phon_no_id, msg_body, user_token, user_name) {
    const session = userSessions[from];
  
    if (msg_body.toLowerCase() === "non") {
      resetSession(session);
      await sendMessage(from, phon_no_id, "Création de ticket annulée.");
      await sendWelcomeMessage(from, phon_no_id, user_name);
      return;
    }
  
    if (msg_body.toLowerCase() !== "oui") {
      await sendMessage(
        from,
        phon_no_id,
        "⚠️ Réponse invalide. Veuillez répondre 'oui' pour confirmer ou 'non' pour annuler."
      );
      return;
    }
  
    try {
      const issueDesc =
        `${session.issueDescription}\n\n` +
        `${doubleHorizontalLine}\n` +
        `Numéro de téléphone: ${from}\n` +
        `Émis par: ${user_name}`;
  
      const issue = {
        issue: {
          project_id: session.selectedProjectId,
          tracker_id: session.selectedTrackerId,
          subject: session.issueSubject,
          description: issueDesc,
          priority_id: session.issuePriority,
          custom_fields: [
            {
              id: parseInt(process.env.PHONE_FIELD_ID), // ID du champ personnalisé pour le numéro de téléphone
              value: from
            }
          ]
        }
      };
  
      const issueResponse = await createIssueFromUser(user_token, issue);
      await sendMessage(
        from,
        phon_no_id,
        `✅ Ticket créé avec succès avec l'ID : ${issueResponse.issue.id}\n\n` +
        `Vous pouvez suivre son évolution en tapant "suivre" à tout moment.`
      );
  
      // Reset session after successful creation
      resetSession(session);
      session.state = "welcome";
    } catch (error) {
      console.error("Error creating ticket:", error);
      await sendMessage(
        from,
        phon_no_id,
        "⚠️ Une erreur est survenue lors de la création du ticket. Veuillez réessayer."
      );
      session.state = "confirm_creation";
    }
  }
  
  async function handleTicketSelection(from, phon_no_id, msg_body, user_token) {
    const session = userSessions[from];
  
    if (msg_body.toLowerCase() === "annuler") {
      resetSession(session);
      await sendMessage(from, phon_no_id, "Opération annulée.");
      await sendWelcomeMessage(from, phon_no_id, session.userName);
      return;
    }
  
    try {
      const issues = await getIssuesByToken(user_token, from);
      const selectedIssue = issues.find(i => i.id == msg_body);
  
      if (!selectedIssue) {
        let issueList = issues.map(i => 
          `ID: ${i.id}, Sujet: ${i.subject}, Statut: ${i.status.name}`
        ).join("\n");
        
        await sendMessage(
          from,
          phon_no_id,
          "⚠️ Ticket invalide. Veuillez sélectionner un ID valide :\n\n" + issueList
        );
        return;
      }
  
      // Format the issue details message
      const statusEmoji = emojies[statusMapping[selectedIssue.status.name.toLowerCase()]] || "";
      const message = 
        `Détails du ticket #${selectedIssue.id}:\n\n` +
        `Sujet: ${selectedIssue.subject}\n` +
        `Statut: ${selectedIssue.status.name} ${statusEmoji}\n` +
        `Priorité: ${selectedIssue.priority.name}\n` +
        `Créé le: ${new Date(selectedIssue.created_on).toLocaleDateString()}\n` +
        `Mise à jour: ${new Date(selectedIssue.updated_on).toLocaleDateString()}\n\n` +
        `Description:\n${selectedIssue.description.substring(0, 200)}...\n\n` +
        `Pour revenir au menu principal, tapez "menu".`;
  
      await sendMessage(from, phon_no_id, message);
      
      // Reset to welcome state but keep project selection
      session.state = "welcome";
      session.selectedProjectId = "";
    } catch (error) {
      console.error("Error handling ticket selection:", error);
      await sendMessage(
        from,
        phon_no_id,
        "⚠️ Une erreur est survenue lors de la récupération des détails du ticket. Veuillez réessayer."
      );
      session.state = "awaiting_ticket_selection";
    }
  }