require('dotenv').config();
const { Telegraf } = require('telegraf');
const { exec } = require('child_process');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

let userState = {}; // To track the user's current state

// Nmap scan options
const scanOptions = [
  { key: '1', description: 'Network Discovery Scan: Discovers live hosts on the network.' },
  { key: '2', description: 'TCP Connect Scan: Performs a TCP connect scan on the target.' },
  { key: '3', description: 'TCP SYN/Stealth Scan: Executes a stealthy TCP SYN scan.' },
  { key: '4', description: 'UDP Scan: Conducts a UDP port scan on the target.' },
  { key: '5', description: 'OS Detection: Attempts to determine the target\'s operating system.' },
  { key: '6', description: 'Version Detection: Tries to identify versions of services running on target ports.' },
  { key: '7', description: 'Vulnerability Detection: Detects vulnerabilities using Nmap scripts.' },
  { key: '8', description: 'Specific Port Scan: Scans a specific port on the target IP.' },
  { key: '9', description: 'Aggressive Scan: Performs an aggressive scan with more information.' },
  { key: '10', description: 'Intense Scan: A more intensive scan that includes all available scan types.' }
];

// Welcome message and options
bot.start((ctx) => {
  userState[ctx.chat.id] = null; // Reset state for the user
  const message = '👋 Welcome! Please choose an option:\n\n1. 🔍 Username Information\n2. 🌐 Nmap Network Scanner';
  ctx.reply(message);
});

// Listen for user choices
bot.on('text', (ctx) => {
  const userId = ctx.chat.id;
  const userMessage = ctx.message.text.trim();

  if (!userState[userId]) {
    // First choice: either username search or Nmap scan
    if (userMessage === '1') {
      userState[userId] = 'awaiting_username';
      ctx.reply('Please send me the username you want to search for:');
    } else if (userMessage === '2') {
      userState[userId] = 'awaiting_nmap_choice';
      let response = 'Please choose a scan option:\n\n';
      scanOptions.forEach(option => {
        response += `${option.key}. ${option.description}\n`;
      });
      ctx.reply(response);
    } else {
      ctx.reply('Invalid option. Please choose 1 for Username Information or 2 for Nmap Network Scanner.');
    }
  } else if (userState[userId] === 'awaiting_username') {
    const username = userMessage;

    if (!username || username.length < 3) {
      return ctx.reply('❌ Please enter a valid username (at least 3 characters).');
    }

    ctx.reply('🔍 Searching for the username... This might take a few minutes, so please be patient. ⏳');

    const sherlockPath = process.env.SHERLOCK_PATH;
    const command = `python3 ${sherlockPath} ${username}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing Sherlock: ${error}`);
        return ctx.reply('⚠️ An error occurred while searching. Please try again later.');
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return ctx.reply('⚠️ An error occurred while searching. Please try again later.');
      }

      const messages = stdout.match(/[\s\S]{1,4000}/g); // Split large outputs
      if (messages) {
        messages.forEach((message, index) => {
          ctx.reply(`🔎 Search results part ${index + 1} for "${username}":\n${message}`);
        });
      } else {
        ctx.reply(`❌ No results found for "${username}".`);
      }
    });

    userState[userId] = null; // Reset state after processing
  } else if (userState[userId] === 'awaiting_nmap_choice') {
    const option = scanOptions.find(o => o.key === userMessage);

    if (option) {
      ctx.reply(`You chose: ${option.description}\nPlease enter the target IP or address:`);

      userState[userId] = `awaiting_nmap_target_${option.key}`;
    } else {
      ctx.reply('Invalid scan option. Please choose a valid scan option.');
    }
  } else if (userState[userId]?.startsWith('awaiting_nmap_target_')) {
    const scanType = userState[userId].split('_').pop();
    const target = userMessage;

    if (scanType === '8') {
      // Specific Port Scan
      ctx.reply('Please enter the specific port number:');
      userState[userId] = `awaiting_nmap_port_${target}`;
    } else {
      performScan(scanType, target, ctx);
      userState[userId] = null; // Reset state after scan
    }
  } else if (userState[userId]?.startsWith('awaiting_nmap_port_')) {
    const target = userState[userId].split('_').pop();
    const port = userMessage;

    performScan('8', target, ctx, port);
    userState[userId] = null; // Reset state after scan
  }
});

// Function to perform Nmap scans
function performScan(scanType, target, ctx, port = null) {
  let command;
  switch (scanType) {
    case '1': command = `nmap -sn ${target}`; break;
    case '2': command = `nmap -sT ${target}`; break;
    case '3': command = `nmap -sS ${target}`; break;
    case '4': command = `nmap -sU ${target}`; break;
    case '5': command = `nmap -O ${target}`; break;
    case '6': command = `nmap -sV ${target}`; break;
    case '7': command = `nmap --script vuln ${target}`; break;
    case '8': command = `nmap -p ${port} ${target}`; break;
    case '9': command = `nmap -A ${target}`; break;
    case '10': command = `nmap -T4 -A -v ${target}`; break;
    default: ctx.reply('Invalid scan type.');
      return;
  }

  exec(command, (error, stdout, stderr) => {
    if (error) {
      ctx.reply(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      ctx.reply(`Error: ${stderr}`);
      return;
    }
    ctx.reply(`Scan results:\n\n${stdout}`);
  });
}

bot.launch();
console.log('🚀 Bot is running...');
