/**
 * @file Redmine utility functions for the Whatsapp-Redmine Interface project
 *
 * @version 0.1
 * @author Moataz K
 * @copyright 2024
 *
 */

const axios = require("axios");
const dotenv = require("dotenv");
const { response } = require("express");

dotenv.config();
const apiUrl = process.env.API_URL;
const apiToken = process.env.ADMIN_TOKEN;

const axiosConfig = {
  headers: {
    "X-Redmine-API-Key": apiToken,
    "Content-Type": "application/json",
  },
};

const getUsers = async (page) => {
    let response = await axios.get(
        `${apiUrl}/users.json?include=custom_fields&limit=100&page=${page}`,
        axiosConfig
      );

    return response.data.users;
    
}

getUser = (users, phone_number) => {
    return users.find((user) => {
        let phoneField = user.custom_fields.find(
            (field) => field.name === "phone"
        );
  
        const phoneNumber = phoneField.value?.replace(/\D/g, "");
        return (
            phoneField &&
            (phoneNumber === phone_number ||
                phone_number === `00${phoneNumber}` ||
                phone_number === `216${phoneNumber}`)
        );
    });
}

//////////////////////////////////////// users ////////////////////////////////////////
const getUserTokenByPhoneNumber = async (phone_number, name) => {
  let userId = null;
    try {
      
    let page = 1;

    let users = await getUsers(page);
 
    while (users.length > 0) {
        const user = getUser(users, phone_number);

        if (user) {
            userId = user.id;
            break;
        }
        page++;
        users = await getUsers(page);
    }

  } catch (error) {
    console.log(error);
    throw new Error(error);
  }

    if (!userId) {
        return null;
    }

  try {
    let response = await axios.get(
      `${apiUrl}/users/${userId}.json`,
      axiosConfig
    );

    return response.data.user.api_key;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

const getUserProjectsByToken = async (token) => {
    try {
    let response = await axios.get(`${apiUrl}/projects.json?limit=100`, {
      headers: {
        "X-Redmine-API-Key": token,
        "Content-Type": "application/json",
      },
    });
    return response.data.projects;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

//////////////////////////////////////// Issues ////////////////////////////////////////

/**
 * Creates a new issue
 * @param {object} issue - An object containing the issue details.
 */
const createIssue = async (issue) => {
  try {
    let response = await axios.post(
      `${apiUrl}/issues.json`,
      issue,
      axiosConfig
    );
    return response.data;
  } catch (error) {
    throw new Error(error.response.data.errors[0]);
  }
};

const createIssueFromUser = async (token, issue) => {
  try {
    console.log(issue);
    let response = await axios.post(`${apiUrl}/issues.json`, issue, {
      headers: {
        "X-Redmine-API-Key": token,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    console.log(error.response.data.errors);
    throw new Error(error);
  }
};
/**
 * Gets all the issues
 */
const getAllIssues = async () => {
  try {
    let response = await axios.get(`${apiUrl}/issues.json?limit=100`, axiosConfig);
    return response.data;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

/**
 * Creates a new issue
 * @param {Integer} Issue_id - The id of the issue to get.
 */
const getIssueById = async (issue_id) => {
  try {
    let response = await axios.get(`/${apiUrl}/issues/${issue_id}.json`);
    return response.data;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

/**
 * Gets all the issues related to a specific project
 * @param {Integer} Project_id - The id of the project to get the issues for.
 * @returns {object} The issues related to the project.
 */
const getIssueByProjectId = async (project_id) => {
  try {
    let response = await axios.get(
      `/${apiUrl}/issues.json?project_id=${project_id}`
    );
    return response.data;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

/**
 * Updates an existing issue
 * @param {Integer} Issue_id - The id of the issue to update.
 * @param {object} new_issue - An object containing the new issue details.
 * @returns {object} The updated issue.
 */
const updateIssue = async (issue_id, new_issue) => {
  try {
    let response = await axios.put(
      `/${apiUrl}/issues/${issue_id}.json`,
      new_issue
    );
    return response.data;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

/**
 * Deletes an existing issue
 * @param {Integer} Issue_id - The id of the issue to delete.
 * @returns {object} The deleted issue.
 */
const deleteIssue = async (issue_id) => {
  try {
    let response = await axios.delete(
      `${apiUrl}/issues/${issue_id}.json`,
      axiosConfig
    );
    return response.data;
  } catch (error) {
    console.log(error.response.data.errors[0]);
    throw new Error(error);
  }
};

/**
 * Delete all issues related to a specific phone number
 * @param {String} phone_number - The phone number to delete the issues for.
 * @returns {object} The deleted issues.
 */
const deleteIssuesByPhoneNumber = async (phone_number) => {
  try {
    let response = await axios.get(`${apiUrl}/issues.json`, axiosConfig);
    let issues = response.data.issues;
    let issuesByPhoneNumber = issues.filter((issue) =>
      issue.description.includes(phone_number)
    );
    issuesByPhoneNumber.forEach((issue) => {
      deleteIssue(issue.id);
    });
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

// not possible since all the issues will have the same author
// the author in this case will be the user related to the ApiToken
// to implement this feature we'll need to save the phone number of the issuer
// inside of the description of the issue: Description : "Issued by: 2162188477"
// then we can get the issues by author by searching for the phone number in the description
// const getIssueByAuthorId = async (author_id) => {
//   try {
//     let response = await axios.get(
//       `/${apiUrl}/issues.json?author_id=${author_id}`
//     );
//     return response.data;
//   } catch (error) {
//     console.log(error);
//     throw new Error(error);
//   }
// };

/**
 * Gets all the issues related to a specific phone number
 * @param {String} phone_number - The phone number to get the issues for.
 * @returns {object} The issues related to the phone number.
 */
const getIssuesByToken = async (token, phone_number) => {
  try {
    let response = await axios.get(`${apiUrl}/issues.json`, {
      headers: {
        "X-Redmine-API-Key": token,
        "Content-Type": "application/json",
      },
    });
    let issues = response.data.issues;

    return issues;
  } catch (error) {
    console.log(error);
    throw new Error("Error connecting to redmine server");
  }
};

//////////////////////////////////////// Projects ////////////////////////////////////////

/**
 * Gets all the projects
 */
const getAllProjects = async () => {
  try {
    let response = await axios.get(`${apiUrl}/projects.json`, axiosConfig);
    return response.data;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

/**
 * Get project by id
 * @param {Integer} project_id - The id of the project to get.
 * @returns {object} The project related to the id.
 */
const getProjectById = async (project_id) => {
  try {
    let response = await axios.get(
      `${apiUrl}/projects/${project_id}.json`,
      axiosConfig
    );
    return response.data;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

/**
 * Gets the project id related to a specific phone number
 * @param {String} phone_number - The phone number to get the project id for.
 * @returns {Integer} The project id related to the phone number.
 */
// const getProjectIdByPhoneNumber = async (phone_number) => {
//   try {
//     let response = await axios.get(`${apiUrl}/projects.json`, axiosConfig);
//     let projects = response.data.projects;
//     let project = projects.find((project) =>
//       project.description.includes(phone_number)
//     );
//     return project ? project.id : null;
//   } catch (error) {
//     console.log(error);
//     throw new Error(error);
//   }
// };

const getProjectsByPhoneNumber = async (phone_number) => {
  try {
    let response = await axios.get(`${apiUrl}/projects.json`, axiosConfig);
    let projects = response.data.projects;
    let userProjects = projects.filter((project) =>
      project.description.includes(phone_number)
    );
    return userProjects;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};
// if no project found with the provided number
// ==> it's the user's first message (new number)
// we use the function below to create a new project
// the project should be created with the phone number as the identifier
// example: whatsapp-21621884770

/**
 * Creates a new project
 * @param {object} project - An object containing the project details.
 * @returns {object} The created project.
 */
const createProject = async (project) => {
  if (project.project.identifier.startsWith("whatsapp-")) {
    try {
      let response = await axios.post(
        `${apiUrl}/projects.json`,
        project,
        axiosConfig
      );
      return response.data;
    } catch (error) {
      throw new Error(error.response.data.errors[0]);
    }
  } else {
    throw new Error(
      "Project Identifer should start with 'whatsapp-' followed by the phone number"
    );
  }
};

/**
 * Delete project by id
 * @param {Integer} project_id - The id of the project to delete.
 * @returns {object} The deleted project.
 */
const deleteProject = async (project_id) => {
  try {
    let response = await axios.delete(
      `${apiUrl}/projects/${project_id}.json`,
      axiosConfig
    );
    return response ? response.data : null;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      throw new Error("Project not found");
    } else {
      console.log("Error:", error.message);
      throw new Error("Failed to delete project");
    }
  }
};

//////////////////////////////////////// Tracker ////////////////////////////////////////
// create a new tracker called whatsapp if it doesnt exist
// getting 403 forbidden even tho using an admin api key
// turns out there's no endpoint to create a tracker
/**
//  * Creates a new tracker called "Whatsapp" if it does not exist
//  * @returns {object} The created tracker.
//  */
// const createTracker = async () => {
//   try {
//     const response = await axios.get(`${apiUrl}/trackers.json`, axiosConfig);
//     const trackers = response.data.trackers;
//     const tracker = trackers.find((tracker) => tracker.name === "Whatsapp");
//     if (!tracker) {
//       const newTracker = {
//         tracker: {
//           name: "Whatsapp",
//         },
//       };
//       try {
//         const createResponse = await axios.post(
//           `${apiUrl}/trackers.json`,
//           newTracker,
//           axiosConfig
//         );
//         console.log("New tracker created:", createResponse.data);
//       } catch (error) {
//         console.error("Error creating tracker:", error.response);
//       }
//     } else {
//       console.log("Whatsapp tracker is already set up");
//     }
//   } catch (error) {
//     console.error("Error fetching trackers:", error);
//     throw new Error(error);
//   }
// };


/**
 * Gets all trackers
 * @returns {object} All the trackers.
 */
const getAllTrackers = async () => {
  try {
      let response = await axios
          .get(`${apiUrl}/trackers.json`, axiosConfig);

    return response?.data?.trackers;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

/**
 * Get trackers by project id
 * @param {Integer} project_id - The id of the project to get the trackers for.
 * * @returns {object} The trackers related to the project.
 * 
 */
const getTrackersByProjectId = async (project_id) => {
    try {
        let response = await axios.get(
        `${apiUrl}/projects/${project_id}/trackers.json`,
        axiosConfig
        );
        return response.data.trackers;
    } catch (error) {
        console.log(error);
        throw new Error(error);
    }
}
    

// we'll check if whatsapp tracker exists before creating an issue
// else we'll warn the user and create in bug tracker

/**
 * Checks if the Whatsapp tracker exist
 * @returns {boolean} True if the tracker exists, false otherwise.
 */
const checkIfTrackerExists = async () => {
  try {
    let response = await axios.get(`${apiUrl}/trackers.json`, axiosConfig);
    let trackers = response.data.trackers;
    let tracker = trackers.find((tracker) => tracker.name === "Whatsapp");
    return tracker ? true : false;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

/////////////////////////////// Priorities ///////////////////////////////
const getAllPriorites = async () => {
  try {
    let response = await axios.get(
      `${apiUrl}/enumerations/issue_priorities.json`,
      axiosConfig
    );
    return response.data;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

  
module.exports = {
  createIssue,
  getAllIssues,
  getIssueById,
  getIssueByProjectId,
  updateIssue,
  deleteIssue,
  // getIssueByAuthorId,
  getIssuesByToken,
    getAllProjects,
    getAllTrackers,
    getTrackersByProjectId,
  getProjectsByPhoneNumber,
  createProject,
  // createTracker,
  checkIfTrackerExists,
  deleteIssuesByPhoneNumber,
  getProjectById,
  deleteProject,
  getAllPriorites,
  getUserProjectsByToken,
  getUserTokenByPhoneNumber,
  createIssueFromUser,
};
