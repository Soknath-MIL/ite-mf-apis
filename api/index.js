const { JSDOM } = require("jsdom");
const express = require("express");
const CryptoJS = require("crypto-js");

const REACT_APP_SITE_DOMAIN = "https://ite-mf.vercel.app";

const encryptAES = (data, key) => { return CryptoJS.AES.encrypt(data, key).toString() };

const getCallFullLink = (callLink) => `${REACT_APP_SITE_DOMAIN}/${callLink}`;
function initBrowser() {
  // Create a DOM environment with jsdom
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const { window } = dom;

  // Set global variables for the jsdom environment
  global.window = window;
  global.wn = window;
  global.document = window.document;
  global.navigator = window.navigator;
  global.XMLHttpRequest = window.XMLHttpRequest;
  global.localStorage = window.localStorage = {
    getItem: function (key) {
      return this[key];
    },
    setItem: function (key, value) {
      this[key] = value.toString();
    },
    removeItem: function (key) {
      delete this[key];
    },
    clear: function () {
      for (let key in this) {
        if (this.hasOwnProperty(key)) {
          delete this[key];
        }
      }
    }
  };
  return dom;
}

let dom = initBrowser();
const SDK = require("mirrorfly-sdk");

// Initialize SDK with necessary parameters
const initializeSDK = async () => {
  const initializeObj = {
    licenseKey: "kE67kQMO8HDsRQGeSgBY9UO1IB0xnX" // Adjust license key as per SDK requirements
    // Add any other required parameters
  };

  try {
    await SDK.initializeSDK(initializeObj);
    console.log("SDK Initialized successfully.");

    // Example usage: Connect or perform other SDK operations
    // const response = await SDK.connect(...);
    // console.log("Connection response:", response);
  } catch (error) {
    console.error("Error initializing SDK:", error);
  }
};

// Call the initialization function
initializeSDK();

// Initialize Express application
const app = express();

// Route to handle SDK operations
app.get("/", (req, res) => res.send("Express on Vercel"));

app.get("/register", async (req, res) => {
  try {
    initBrowser();
    const { uid, username } = req.query;
    // Register user
    const response = await SDK.register(uid, true);
    console.log("Registration Response:", response);

    // Connect user
    const { username: sdkUsername, password } = response.data;
    await SDK.connect(sdkUsername, password);
    console.log("Connected successfully.");

    // Update user profile
    const setProfile = await SDK.setUserProfile(username, "", "I'm in ITE-MF", uid, `${uid}@admin.com`);
    console.log("Set Profile Response:", setProfile);

    // Retrieve user profile
    const userProfile = await SDK.getUserProfile(response.data.userJid);
    console.log("User Profile:", userProfile);

    dom.window.close();

    return res.json(userProfile);
  } catch (error) {
    // console.error("Error in /register endpoint:", error);
    return res.status(500).json({
      statusCode: 500,
      message: "Error",
      data: "Internal Server Error"
    });
  }
});

app.get("/createMeetingLink", async (req, res) => {
  try {
    const data = req.query;
    initBrowser();

    if (!data.users || !data.uid || !parseInt(data.timeout) || !data.refid) {
      return res.json({ status: "error", message: "data not complete" });
    }
    if (parseInt(data.timeout) <= 5) {
      return res.json({ status: "error", message: "Cannot set timeout less then 5 mins" });
    }

    const tryRegister = await SDK.register(data.uid, true);
    if (tryRegister.statusCode === 200) {
      const { data: { username = "", password = "", token = "" } = {} } = tryRegister;
      if (username && password) {
        await SDK.connect(username, password);
        const response = await SDK.createMeetLink();
        console.log("response", response);
        if (response.statusCode === 200) {
          const meetLink = getCallFullLink(response.data);
          let links = {};
          data.users.split(",").map((each) => {
            let ecytData = encryptAES(JSON.stringify({ ...data, uid: each }), "meetingData");
            links[each] = `${meetLink}?action=meeting&data=${ecytData}`;
          });
          return res.json({
            statusCode: 200,
            message: "Success",
            data: {
              refid: data.refid,
              meetingUrl: links
            }
          });
        }
      }
    }

    return res.json({ status: "error", message: "NO permission to create meeting link" });
  } catch (error) {
    // console.error("Error in /register endpoint:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server ready on port ${PORT}`));

module.exports = app;
