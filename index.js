// https://github.com/Wisky-NM/wt-autoread-bot

const {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  jidNormalizedUser,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const fs = require("fs");
const path = require("path");
const colors = require("colors");
const moment = require("moment-timezone");

let useCode = true;
let loggedInNumber;

function logMessage(message, type = "green") {
  moment.locale("en");
  const now = moment().tz("Asia/Jakarta");
  console.log(
    `\n${now.format(" dddd ").bgRed}${
      now.format(" D MMMM YYYY ").bgYellow.black
    }${now.format(" HH:mm:ss ").bgWhite.black}\n`,
  );
  console.log(`${message.bold[type]}`);
}

const configPath = path.join(__dirname, "config.json");
let config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

let {
  autoReadStatus,
  autoLikeStatus,
  downloadMediaStatus,
  sensorNomor,
  antiTelpon,
  autoKickStory,
  blackList,
  whiteList,
  emojis,
} = config;

const updateConfig = (key, value) => {
  config[key] = value;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 4), "utf-8");
};

let welcomeMessage = false;

async function connectToWhatsApp() {
  const sessionPath = path.join(__dirname, "sessions");
  const sessionExists =
    fs.existsSync(sessionPath) && fs.readdirSync(sessionPath).length > 0;

  const { state, saveCreds } = await useMultiFileAuthState("sessions");
  const { version, isLatest } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state,
    printQRInTerminal: !useCode,
    defaultQueryTimeoutMs: undefined,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 350,

    browser: Browsers.macOS("Safari"),
    shouldSyncHistoryMessage: () => true,
    syncFullHistory: true,
    generateHighQualityLinkPreview: true,

    getMessage: async () => undefined,
  });

  if (useCode && !sessionExists) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    logMessage(
      "Hello, you haven't logged in yet. Do you want to login using pairing code?\nPlease answer (y/n)\nType y to agree or n to use QR code",
      "cyan",
    );

    const askPairingCode = () => {
      rl.question(
        "\nDo you want to use pairing code to login to WhatsApp? (y/n): ".yellow.bold,
        async (answer) => {
          if (answer.toLowerCase() === "y" || answer.trim() === "") {
            logMessage(
              "OK then, please enter your WhatsApp number!\nNote: start with your country code\nExample Yemen: 967XXXXXXXXX | Egypt: 20XXXXXXXXXX | Indonesia: 62XXXXXXXXXX",
              "cyan",
            );
            const askWaNumber = () => {
              rl.question(
                "\nEnter your WhatsApp number: ".yellow.bold,
                async (waNumber) => {
                  if (!/^\d+$/.test(waNumber)) {

                    logMessage(
                      "Number must contain only digits!\nPlease enter your WhatsApp number again.",
                      "red",
                    );
                    askWaNumber();
                  } else {
                    try {
                      const code = await sock.requestPairingCode(waNumber, "WISKYYYY");
                      console.log(
                        "\nCheck your WhatsApp notifications and enter the login code:".blue.bold,
                        code.bold.red,
                      );
                      rl.close();
                    } catch (err) {
                      logMessage(`Failed to request pairing code: ${err.message}`, "red");
                      askWaNumber();
                    }
                  }
                },
              );
            };
            askWaNumber();
          } else if (answer.toLowerCase() === "n") {
            useCode = false;
            logMessage(
              "Open WhatsApp, tap the three dots in the top right, then tap Linked Devices. Scan the QR code below to login to WhatsApp.",
              "cyan",
            );
            connectToWhatsApp();
            rl.close();
          } else {
            logMessage('Invalid input. Please enter "y" or "n".', "red");
            askPairingCode();
          }
        },
      );
    };

    askPairingCode();
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        logMessage("Attempting to reconnect to WhatsApp...\n", "cyan");
        connectToWhatsApp();
      } else {
        logMessage(
          "You have been logged out of WhatsApp, please login again!",
          "red",
        );

        fs.rmSync(sessionPath, { recursive: true, force: true });
        welcomeMessage = false;
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      logMessage("Successfully connected to WhatsApp");
      loggedInNumber = sock.user.id.split("@")[0].split(":")[0];
      let displayedLoggedInNumber = loggedInNumber;
      if (sensorNomor) {
        displayedLoggedInNumber =
          displayedLoggedInNumber.slice(0, 3) +
          "****" +
          displayedLoggedInNumber.slice(-2);
      }
      let messageInfo = `*AutoReadStoryWhatsApp Bot Active!*
You have successfully logged in with number: ${displayedLoggedInNumber}

Feature Status:
- Auto Read Status: ${autoReadStatus ? "*Active*" : "*Inactive*"}
- Auto Like Status: ${autoLikeStatus ? "*Active*" : "*Inactive*"}
- Download Media Status: ${downloadMediaStatus ? "*Active*" : "*Inactive*"}
- Hide Numbers: ${sensorNomor ? "*Active*" : "*Inactive*"}
- Anti Call: ${antiTelpon ? "*Active*" : "*Inactive*"}
- Auto Kick Tag Story: ${autoKickStory ? "*Active*" : "*Inactive*"}

Type *#menu* to see available commands.

SC: https://github.com/Wisky-NM/wt-autoread-bot`;

      console.log(
        `You have successfully logged in with number:`.green.bold,
        displayedLoggedInNumber.yellow.bold,
      );
      console.log(
        "Bot is active!\n\nEnjoy auto read story whatsapp feature by".green.bold,
        "github.com/Wisky-NM\n".red.bold,
      );

      if (!welcomeMessage) {
        setTimeout(async () => {
          await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, {
            text: messageInfo,
          });
          welcomeMessage = true;
        }, 5000);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("call", (call) => {
    const { id, status, from } = call[0];
    if (status === "offer" && antiTelpon) return sock.rejectCall(id, from);
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    msg.type = msg.message.imageMessage
      ? "imageMessage"
      : msg.message.videoMessage
        ? "videoMessage"
        : msg.message.audioMessage
          ? "audioMessage"
          : msg.message.extendedTextMessage
            ? "extendedTextMessage"
            : Object.keys(msg.message)[0];

    msg.text =
      msg.type === "conversation"
        ? msg.message.conversation
        : msg.type === "extendedTextMessage"
          ? msg.message.extendedTextMessage.text
          : msg.message[msg.type]?.caption || "";

    msg.isQuoted =
      msg.type === "extendedTextMessage"
        ? msg.message.extendedTextMessage.contextInfo?.quotedMessage
        : msg.type === "imageMessage"
          ? msg.message.imageMessage.contextInfo?.quotedMessage
          : msg.type === "videoMessage"
            ? msg.message.videoMessage.contextInfo?.quotedMessage
            : msg.type === "audioMessage"
              ? msg.message.audioMessage.contextInfo?.quotedMessage
              : null;

    msg.quoted = msg.isQuoted
      ? msg.message.extendedTextMessage?.contextInfo ||
        msg.message.imageMessage?.contextInfo ||
        msg.message.videoMessage?.contextInfo ||
        msg.message.audioMessage?.contextInfo
      : null;

    const prefixes = [".", "#", "!", "/"];
    let prefix = prefixes.find((p) => msg.text.startsWith(p));

    if (prefix && msg.key.fromMe) {
      msg.cmd = msg.text.trim().split(" ")[0].replace(prefix, "").toLowerCase();
      msg.args = msg.text.replace(/^\S*\b/g, "").trim().split("|");

      async function validateNumber(commandname, action, preposition, data) {
        if (!data) {
          await sock.sendMessage(
            `${loggedInNumber}@s.whatsapp.net`,
            {
              text: `Number is required.\nExample: \`${commandname} blacklist 628123456789\`\n\nAvailable arguments:\n\n\`${commandname} blacklist number\`\nto ${action} number ${preposition} blacklist\n\n\`${commandname} whitelist number\`\nto ${action} number ${preposition} whitelist`,
            },
            { quoted: msg },
          );
          return false;
        }
        if (!/^\d+$/.test(data)) {
          await sock.sendMessage(
            `${loggedInNumber}@s.whatsapp.net`,
            {
              text: `Number must contain only digits.\nExample: \`${commandname} blacklist 628123456789\``,
            },
            { quoted: msg },
          );
          return false;
        }
        return true;
      }

      switch (msg.cmd) {
        case "on":
          msg.args[0].trim() === ""
            ? await sock.sendMessage(
                `${loggedInNumber}@s.whatsapp.net`,
                {
                  text: `Argument missing.\nExample: \`#on autolike\`\n\nAvailable arguments:\n\n\`#on autoread\`\nto enable auto read story\n\n\`#on autolike\`\nto enable auto like story\n\n\`#on dlmedia\`\nto enable download media (photo, video, audio) from story\n\n\`#on sensornomor\`\nto enable number hiding\n\n\`#on antitelpon\`\nto enable anti-call\n\n\`#on kickstory\`\nto enable auto kick group tag in story`,
                },
                { quoted: msg },
              )
            : msg.args.forEach(async (arg) => {
                switch (arg.trim().toLowerCase()) {
                  case "autoread":
                    autoReadStatus = true;
                    updateConfig("autoReadStatus", true);
                    logMessage("You enabled Auto Read Status feature", "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: "Auto Read Status activated" }, { quoted: msg });
                    break;
                  case "autolike":
                    autoLikeStatus = true;
                    updateConfig("autoLikeStatus", true);
                    logMessage("You enabled Auto Like Status feature", "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: "Auto Like Status activated" }, { quoted: msg });
                    break;
                  case "dlmedia":
                    downloadMediaStatus = true;
                    updateConfig("downloadMediaStatus", true);
                    logMessage("You enabled Download Media Status feature", "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: "Download Media Status activated" }, { quoted: msg });
                    break;
                  case "sensornomor":
                    sensorNomor = true;
                    updateConfig("sensorNomor", true);
                    logMessage("You enabled Number Hiding feature", "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: "Number Hiding activated" }, { quoted: msg });
                    break;
                  case "antitelpon":
                    antiTelpon = true;
                    updateConfig("antiTelpon", true);
                    logMessage("You enabled Anti-Call feature", "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: "Anti-Call activated" }, { quoted: msg });
                    break;
                  case "kickstory":
                    autoKickStory = true;
                    updateConfig("autoKickStory", true);
                    logMessage("You enabled Auto Kick Group Tag in Story feature", "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: "Auto Kick Group Tag in Story activated" }, { quoted: msg });
                    break;
                  default:
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Invalid argument: ${arg}. Available options: autoread, autolike, dlmedia, sensornomor, kickstory, antitelpon` }, { quoted: msg });
                    break;
                }
              });
          break;

        case "off":
          msg.args[0].trim() === ""
            ? await sock.sendMessage(
                `${loggedInNumber}@s.whatsapp.net`,
                {
                  text: `Argument missing.\nExample: \`#off autolike\`\n\nAvailable arguments:\n\n\`#off autoread\`\nto disable auto read story\n\n\`#off autolike\`\nto disable auto like story\n\n\`#off dlmedia\`\nto disable download media (photo, video, audio) from story\n\n\`#off sensornomor\`\nto disable number hiding\n\n\`#off antitelpon\`\nto disable anti-call\n\n\`#off kickstory\`\nto disable auto kick group tag in story`,
                },
                { quoted: msg },
              )
            : msg.args.forEach(async (arg) => {
                switch (arg.trim().toLowerCase()) {
                  case "autoread":
                    autoReadStatus = false;
                    updateConfig("autoReadStatus", false);
                    logMessage("You disabled Auto Read Status feature", "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: "Auto Read Status deactivated" }, { quoted: msg });
                    break;
                  case "autolike":
                    autoLikeStatus = false;
                    updateConfig("autoLikeStatus", false);
                    logMessage("You disabled Auto Like Status feature", "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: "Auto Like Status deactivated" }, { quoted: msg });
                    break;
                  case "dlmedia":
                    downloadMediaStatus = false;
                    updateConfig("downloadMediaStatus", false);
                    logMessage("You disabled Download Media Status feature", "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: "Download Media Status deactivated" }, { quoted: msg });
                    break;
                  case "sensornomor":
                    sensorNomor = false;
                    updateConfig("sensorNomor", false);
                    logMessage("You disabled Number Hiding feature", "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: "Number Hiding deactivated" }, { quoted: msg });
                    break;
                  case "antitelpon":
                    antiTelpon = false;
                    updateConfig("antiTelpon", false);
                    logMessage("You disabled Anti-Call feature", "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: "Anti-Call deactivated" }, { quoted: msg });
                    break;
                  case "kickstory":
                    autoKickStory = false;
                    updateConfig("autoKickStory", false);
                    logMessage("You disabled Auto Kick Group Tag in Story feature", "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: "Auto Kick Group Tag in Story deactivated" }, { quoted: msg });
                    break;
                  default:
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Invalid argument: ${arg}. Available options: autoread, autolike, dlmedia, sensornomor, kickstory, antitelpon` }, { quoted: msg });
                    break;
                }
              });
          break;

        case "add":
          msg.args[0].trim() === ""
            ? await sock.sendMessage(
                `${loggedInNumber}@s.whatsapp.net`,
                {
                  text: `Argument missing.\nExample: \`#add blacklist 628123456789\`\n\nAvailable arguments:\n\n\`#add blacklist number\`\nto add number to blacklist\n\n\`#add whitelist number\`\nto add number to whitelist\n\n\`#add emojis emoji\`\nto add emoji to emojis list`,
                },
                { quoted: msg },
              )
            : msg.args.forEach(async (arg) => {
                const [list, data] = arg.trim().split(" ");
                if (list === "emojis") {
                  let emojiRegex = /^[\p{Emoji}\u200D\uFE0F]$/gu;
                  if (!data) {
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Emoji is required.\nExample: \`#add emojis 👍\`` }, { quoted: msg });
                    return;
                  }
                  if (!emojiRegex.test(data)) {
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Only 1 emoji is allowed.\nExample: \`#add emojis 👍\`` }, { quoted: msg });
                    return;
                  }
                  if (!emojis.includes(data)) {
                    emojis.push(data);
                    updateConfig("emojis", emojis);
                    logMessage(`You added emoji ${data} to emojis list`, "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Emoji ${data} successfully added to emojis list` }, { quoted: msg });
                  } else {
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Emoji ${data} is already in emojis list` }, { quoted: msg });
                  }
                } else if (list === "blacklist") {
                  const isValid = await validateNumber("#add", "add", "to", data);
                  if (!isValid) return;
                  let displayNumber = data;
                  if (sensorNomor) displayNumber = displayNumber.slice(0, 3) + "****" + displayNumber.slice(-2);
                  if (!blackList.includes(data)) {
                    blackList.push(data);
                    updateConfig("blackList", blackList);
                    logMessage(`You added number ${displayNumber} to blacklist`, "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Number ${displayNumber} successfully added to blacklist` }, { quoted: msg });
                  } else {
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Number ${displayNumber} is already in blacklist` }, { quoted: msg });
                  }
                } else if (list === "whitelist") {
                  const isValid = await validateNumber("#add", "add", "to", data);
                  if (!isValid) return;
                  let displayNumber = data;
                  if (sensorNomor) displayNumber = displayNumber.slice(0, 3) + "****" + displayNumber.slice(-2);
                  if (!whiteList.includes(data)) {
                    whiteList.push(data);
                    updateConfig("whiteList", whiteList);
                    logMessage(`You added number ${displayNumber} to whitelist`, "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Number ${displayNumber} successfully added to whitelist` }, { quoted: msg });
                  } else {
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Number ${displayNumber} is already in whitelist` }, { quoted: msg });
                  }
                } else {
                  await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Invalid argument: ${arg}. Available options: blacklist, whitelist, emojis` }, { quoted: msg });
                }
              });
          break;

        case "remove":
          msg.args[0].trim() === ""
            ? await sock.sendMessage(
                `${loggedInNumber}@s.whatsapp.net`,
                {
                  text: `Argument missing.\nExample: \`#remove blacklist 628123456789\`\n\nAvailable arguments:\n\n\`#remove blacklist number\`\nto remove number from blacklist\n\n\`#remove whitelist number\`\nto remove number from whitelist\n\n\`#remove emojis emoji\`\nto remove emoji from emojis list`,
                },
                { quoted: msg },
              )
            : msg.args.forEach(async (arg) => {
                const [list, data] = arg.trim().split(" ");
                if (list === "emojis") {
                  let emojiRegex = /^[\p{Emoji}\u200D\uFE0F]$/gu;
                  if (!data) {
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Emoji is required.\nExample: \`#remove emojis 👍\`` }, { quoted: msg });
                    return;
                  }
                  if (!emojiRegex.test(data)) {
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Only 1 emoji is allowed.\nExample: \`#remove emojis 👍\`` }, { quoted: msg });
                    return;
                  }
                  if (emojis.length === 1) {
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Cannot remove the last emoji. At least one emoji must remain.\n\nType \`#info\` to check available emojis` }, { quoted: msg });
                    return;
                  }
                  if (emojis.includes(data)) {
                    emojis = emojis.filter((n) => n !== data);
                    updateConfig("emojis", emojis);
                    logMessage(`You removed emoji ${data} from emojis list`, "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Emoji ${data} successfully removed from emojis list` }, { quoted: msg });
                  } else {
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Emoji ${data} not found in emojis list\n\nType \`#info\` to check available emojis` }, { quoted: msg });
                  }
                } else if (list === "blacklist") {
                  const isValid = await validateNumber("#remove", "remove", "from", data);
                  if (!isValid) return;
                  let displayNumber = data;
                  if (sensorNomor) displayNumber = displayNumber.slice(0, 3) + "****" + displayNumber.slice(-2);
                  if (blackList.includes(data)) {
                    blackList = blackList.filter((n) => n !== data);
                    updateConfig("blackList", blackList);
                    logMessage(`You removed number ${displayNumber} from blacklist`, "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Number ${displayNumber} successfully removed from blacklist` }, { quoted: msg });
                  } else {
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Number ${displayNumber} not found in blacklist\n\nType \`#info\` to check available numbers` }, { quoted: msg });
                  }
                } else if (list === "whitelist") {
                  const isValid = await validateNumber("#remove", "remove", "from", data);
                  if (!isValid) return;
                  let displayNumber = data;
                  if (sensorNomor) displayNumber = displayNumber.slice(0, 3) + "****" + displayNumber.slice(-2);
                  if (whiteList.includes(data)) {
                    whiteList = whiteList.filter((n) => n !== data);
                    updateConfig("whiteList", whiteList);
                    logMessage(`You removed number ${displayNumber} from whitelist`, "blue");
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Number ${displayNumber} successfully removed from whitelist` }, { quoted: msg });
                  } else {
                    await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Number ${displayNumber} not found in whitelist\n\nType \`#info\` to check available numbers` }, { quoted: msg });
                  }
                } else {
                  await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Invalid argument: ${arg}. Available options: blacklist, whitelist, emojis` }, { quoted: msg });
                }
              });
          break;

        case "menu":
          const menuMessage = `Command List:
Example usage: #on autolike

ON Commands:
\`#on autoread\` - Enable auto read story
\`#on autolike\` - Enable auto like story
\`#on dlmedia\` - Enable download media from story
\`#on sensornomor\` - Enable number hiding
\`#on antitelpon\` - Enable anti-call
\`#on kickstory\` - Enable auto kick group tag in story

OFF Commands:
\`#off autoread\` - Disable auto read story
\`#off autolike\` - Disable auto like story
\`#off dlmedia\` - Disable download media from story
\`#off sensornomor\` - Disable number hiding
\`#off antitelpon\` - Disable anti-call
\`#off kickstory\` - Disable auto kick group tag in story

ADD Commands:
\`#add blacklist number\` - Add number to blacklist
\`#add whitelist number\` - Add number to whitelist
\`#add emojis emoji\` - Add emoji to emojis list

REMOVE Commands:
\`#remove blacklist number\` - Remove number from blacklist
\`#remove whitelist number\` - Remove number from whitelist
\`#remove emojis emoji\` - Remove emoji from emojis list

INFO Command:
\`#info\` - Display feature status and lists

VIEWONCE Command:
\`#viewonce\` - Retrieve view-once photo/video/audio (reply to the message)
`;
          await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: menuMessage }, { quoted: msg });
          break;

        case "viewonce":
          if (msg.isQuoted && msg.quoted && msg.quoted.quotedMessage) {
            if (msg.quoted.quotedMessage.imageMessage) {
              let buffer = await downloadMediaMessage(
                { message: { imageMessage: msg.quoted.quotedMessage.imageMessage }, key: msg.quoted.key },
                "buffer", {}, { logger: pino({ level: "fatal" }) },
              );
              await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { image: Buffer.from(buffer) }, { quoted: msg });
              logMessage("Successfully retrieved view-once image from replied message", "blue");
              buffer = null;
            } else if (msg.quoted.quotedMessage.videoMessage) {
              let buffer = await downloadMediaMessage(
                { message: { videoMessage: msg.quoted.quotedMessage.videoMessage }, key: msg.quoted.key },
                "buffer", {}, { logger: pino({ level: "fatal" }) },
              );
              await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { video: Buffer.from(buffer) }, { quoted: msg });
              logMessage("Successfully retrieved view-once video from replied message", "blue");
              buffer = null;
            } else if (msg.quoted.quotedMessage.audioMessage) {
              let buffer = await downloadMediaMessage(
                { message: { audioMessage: msg.quoted.quotedMessage.audioMessage }, key: msg.quoted.key },
                "buffer", {}, { logger: pino({ level: "fatal" }) },
              );
              await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { audio: Buffer.from(buffer) }, { quoted: msg });
              logMessage("Successfully retrieved view-once audio from replied message", "blue");
              buffer = null;
            } else {
              await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `The message you replied to is not a view-once photo, video, or audio message` }, { quoted: msg });
              logMessage("The message you replied to is not a view-once photo, video, or audio message", "yellow");
            }
          } else {
            await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: `Reply to a view-once message with the #viewonce command` }, { quoted: msg });
          }
          break;

        case "info":
          const infoMessage = `Feature Status Information:
- Auto Read Status: ${autoReadStatus ? "*Active*" : "*Inactive*"}
- Auto Like Status: ${autoLikeStatus ? "*Active*" : "*Inactive*"}
- Download Media Status: ${downloadMediaStatus ? "*Active*" : "*Inactive*"}
- Number Hiding: ${sensorNomor ? "*Active*" : "*Inactive*"}
- Anti Call: ${antiTelpon ? "*Active*" : "*Inactive*"}
- Auto Kick Tag Story: ${autoKickStory ? "*Active*" : "*Inactive*"}`;

          const formatList = (list) =>
            list.map((number) => {
              let displayNumber = number;
              if (sensorNomor) displayNumber = displayNumber.slice(0, 3) + "****" + displayNumber.slice(-2);
              return `\u25CF ${displayNumber}`;
            }).join("\n");

          const formatEmojiList = (list) => list.join(", ");

          const blacklistMessage = blackList.length > 0 ? `Blacklist:\n${formatList(blackList)}` : "Blacklist is empty.";
          const whitelistMessage = whiteList.length > 0 ? `Whitelist:\n${formatList(whiteList)}` : "Whitelist is empty.";
          const emojisMessage = emojis.length > 0 ? `Emojis:\n${formatEmojiList(emojis)}` : "Emojis list is empty.";
          const listMessage = `\n\n${blacklistMessage}\n\n${whitelistMessage}\n\n${emojisMessage}\n\nType \`#add\` to add | \`#remove\` to remove | \`#on\`/\`#off\` to toggle | \`#menu\` for all commands`;

          await sock.sendMessage(`${loggedInNumber}@s.whatsapp.net`, { text: infoMessage + listMessage }, { quoted: msg });
          break;
      }
    }

    if (autoKickStory) {
      if (msg.message.groupStatusMentionMessage && !msg.key.fromMe) {
        const groupId = msg.key.remoteJid;

        const participant =
          msg.key.participantAlt && !msg.key.participantAlt.includes("@lid")
            ? msg.key.participantAlt
            : msg.key.participant;

        if (!participant) return;

        try {
          const groupMetadata = await sock.groupMetadata(groupId);
          const groupName = groupMetadata.subject;
          const botJid = jidNormalizedUser(sock.user.id);

          const isAdmin = groupMetadata.participants.some(
            (member) =>
              jidNormalizedUser(member.id) === botJid && member.admin !== null,
          );

          if (isAdmin) {
            await sock.sendMessage(
              groupId,
              {
                text: `@${participant.split("@")[0]} detected tagging group in story, you will be kicked.`,
                mentions: [participant],
              },
              { quoted: msg },
            );
            await sock.groupParticipantsUpdate(groupId, [participant], "remove");
            logMessage(
              `You kicked someone from group ${groupName} because they tagged the group in their story.`,
              "red",
            );
          } else {
            logMessage(`You are not an admin in group ${groupName}, cannot kick.`, "yellow");
          }
        } catch (err) {
          logMessage(`Error in autoKickStory: ${err.message}`, "red");
        }
      }
    }

    if (msg.key.remoteJid === "status@broadcast" && autoReadStatus) {

      let senderJid = msg.key.remoteJidAlt ||
        (msg.key.participant && !msg.key.participant.includes("@lid")
          ? msg.key.participant
          : null);

      if (
        senderJid &&
        jidNormalizedUser(senderJid) === jidNormalizedUser(sock.user.id)
      ) return;

      let senderNumber = senderJid
        ? senderJid.split("@")[0].split(":")[0]
        : "Unknown";

      let displaySenderNumber = senderNumber;
      const senderName = msg.pushName || "Unknown";

      if (sensorNomor && displaySenderNumber !== "Unknown") {
        displaySenderNumber =
          displaySenderNumber.slice(0, 3) + "****" + displaySenderNumber.slice(-2);
      }

      if (msg.message.protocolMessage) {
        logMessage(`Status from ${senderName} (${displaySenderNumber}) has been deleted.`, "red");
        return;
      }

      if (msg.message.reactionMessage) return;

      if (blackList.includes(senderNumber)) {
        logMessage(`${senderName} (${displaySenderNumber}) is on blacklist. Status will not be viewed.`, "yellow");
        return;
      }

      if (whiteList.length > 0 && !whiteList.includes(senderNumber)) {
        logMessage(`${senderName} (${displaySenderNumber}) is not on whitelist. Status will not be viewed.`, "yellow");
        return;
      }

      const myself = jidNormalizedUser(sock.user.id);
      const emojiToReact = emojis[Math.floor(Math.random() * emojis.length)];

      try {

        const readKey = { ...msg.key, participant: senderJid };
        await sock.readMessages([readKey]);

        if (autoLikeStatus) {
          const realJid = msg.key.remoteJidAlt || senderJid;
          const statusJidList = [myself, `${loggedInNumber}@s.whatsapp.net`];
          if (realJid) statusJidList.push(realJid);

          await sock.sendMessage(
            "status@broadcast",
            {
              react: {
                key: {
                  remoteJid: "status@broadcast",
                  id: msg.key.id,
                  participant: realJid,
                  fromMe: false,
                },
                text: emojiToReact,
              },
            },
            { statusJidList },
          );
        }

        logMessage(
          `Successfully viewed ${autoLikeStatus ? "and liked " : ""}status from: ${senderName} (${displaySenderNumber})`,
          "green",
        );

        const targetNumber = loggedInNumber;
        let messageContent = `Status from *${senderName}* (${displaySenderNumber}) has been viewed${autoLikeStatus ? " and liked" : ""}`;

        let caption =
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          msg.message.extendedTextMessage?.text ||
          "No caption";

        if (downloadMediaStatus) {
          if (msg.type === "imageMessage" || msg.type === "videoMessage") {
            let mediaType = msg.type === "imageMessage" ? "image" : "video";
            messageContent = `${mediaType === "image" ? "Image" : "Video"} status from *${senderName}* (${displaySenderNumber}) has been viewed${autoLikeStatus ? " and liked" : ""}`;
            try {
              let buffer = await downloadMediaMessage(msg, "buffer", {}, { logger: pino({ level: "fatal" }) });
              await sock.sendMessage(`${targetNumber}@s.whatsapp.net`, {
                [mediaType]: Buffer.from(buffer),
                caption: `${messageContent} with caption: "*${caption}*"`,
              });
              buffer = null;
            } catch (error) {
              logMessage(`Error uploading media: ${error.message}`, "red");
              await sock.sendMessage(`${targetNumber}@s.whatsapp.net`, {
                text: `${messageContent} but failed to upload ${mediaType} media.`,
              });
            }
          } else if (msg.type === "audioMessage") {
            messageContent = `Audio status from *${senderName}* (${displaySenderNumber}) has been viewed${autoLikeStatus ? " and liked" : ""}. Here is the audio.`;
            await sock.sendMessage(`${targetNumber}@s.whatsapp.net`, { text: messageContent });
            try {
              let buffer = await downloadMediaMessage(msg, "buffer", {}, { logger: pino({ level: "fatal" }) });
              await sock.sendMessage(`${targetNumber}@s.whatsapp.net`, { audio: Buffer.from(buffer) });
              buffer = null;
            } catch (error) {
              logMessage(`Error uploading audio: ${error.message}`, "red");
              await sock.sendMessage(`${targetNumber}@s.whatsapp.net`, {
                text: `Failed to upload audio from *${senderName}* (${displaySenderNumber}).`,
              });
            }
          } else {
            messageContent = `Text status from *${senderName}* (${displaySenderNumber}) has been viewed${autoLikeStatus ? " and liked" : ""} with caption: "*${caption}*"`;
            await sock.sendMessage(`${targetNumber}@s.whatsapp.net`, { text: messageContent });
          }
        } else {
          await sock.sendMessage(`${targetNumber}@s.whatsapp.net`, { text: messageContent });
        }
      } catch (err) {
        logMessage(`Error handling status: ${err.message}`, "red");
      }
    }
  });
}

connectToWhatsApp();

