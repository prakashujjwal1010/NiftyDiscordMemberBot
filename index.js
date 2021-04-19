const Discord = require("discord.js");
const config = require("./config.json");
const YourCollectible_ABI = require("./contracts/YourCollectible.abi.js");
const YourCollectible_address = require("./contracts/YourCollectible.address.js");
const Web3 = require("web3");

const client = new Discord.Client();
let clientReady = false;
const web3 = new Web3(new Web3.providers.HttpProvider("https://goerli.infura.io/v3/ecd9d1cce3ec4df498a1526dcb706d7a"));
const web3Socket = new Web3(new Web3.providers.WebsocketProvider("wss://goerli.infura.io/ws/v3/ecd9d1cce3ec4df498a1526dcb706d7a"));

const contractInstance = new web3.eth.Contract(YourCollectible_ABI, YourCollectible_address);
const contractSocketInstance = new web3Socket.eth.Contract(YourCollectible_ABI, YourCollectible_address);

const handleEvents = async (tokenId, ownerUserID) => {
  const channels = ['nifty-discord-text', 'Nifty-Discord-Voice'];
  const roleName = 'Test Role';
  if (clientReady) {
    let guildID = await contractInstance.methods.getTokenCreatorGuildID(tokenId).call();
    console.log(guildID);
    //let ownerUserID = await contractInstance.methods.getTokenOwnerDiscordID(tokenId).call();
    console.log(ownerUserID);
    const guild = await client.guilds.cache.get(guildID);
    console.log(guild);
    let textChannel = guild.channels.cache.find(c => c.name === channels[0] && c.type == "text");
    let voiceChannel = guild.channels.cache.find(c => c.name === channels[1] && c.type == "voice");
    //if(guild.owne)
    console.log(ownerUserID);
    if(textChannel){
      try {
        await textChannel.overwritePermissions([{
          id: ownerUserID,
          deny: ['VIEW_CHANNEL']
        }]);
      } catch (e) {
        console.log(e);
      }
    }

    if(voiceChannel){
      try {
        await voiceChannel.overwritePermissions([{
          id: ownerUserID,
          deny: ['VIEW_CHANNEL']
        }]);
      } catch (e) {
        console.log(e);
      }
    }

  }

}

contractSocketInstance.events.Transfer()
  .on('data', function(event) {
    console.log(event);
    //handleEvents(1);
  })
  .on('error', console.error);


contractSocketInstance.events.AccessActivated()
  .on('data', function(event) {
    const returnValues = event.returnValues;
    console.log(returnValues);
    console.log(returnValues.discordID.toString());

    //handleEvents(1);
  })
  .on('error', console.error);

contractSocketInstance.events.AccessDeactivated()
  .on('data', function(event) {
    const returnValues = event.returnValues;
    console.log(returnValues);
    handleEvents(returnValues.tokenId, returnValues.discordID);
  })
  .on('error', console.error);

client.once("ready", async () => {
  console.log("ready!");
  //console.log(client);
  clientReady = true;
})

const prefix = "!";

client.on("message", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const commandBody = message.content.slice(prefix.length);
  const args = commandBody.split(' ');
  const command = args.shift().toLowerCase();

  if (command === "ping") {
    const timeTaken = Date.now() - message.createdTimestamp;
    message.reply(`Pong! This message had a latency of ${timeTaken}ms.`);
  }

  if (command === "test-event") {
    handleEvents(1)
  }

  if (command === "create-nifty-discord") {
    const channels = ['nifty-discord-text', 'Nifty-Discord-Voice'];
    const categoryName = 'NIFTY-DISCORD-MEMBERS';
    const everyoneRole = await message.guild.roles.cache.find(r => r.name === '@everyone');
    //console.log(everyoneRole);
    let category = await message.guild.channels.cache.find(c => c.name == categoryName && c.type == "category");
    if (!category) {
      try {
        category = await message.guild.channels.create(categoryName, {
          type: 'category',
          permissionOverwrites: [{
              id: client.user.id,
              allow: ['ADMINISTRATOR'],
            },
            {
              id: everyoneRole.id,
              deny: ['VIEW_CHANNEL'],
            },
          ],
        })
      } catch (e) {
        console.log(e);
      };
    }

    let textChannel = message.guild.channels.cache.find(c => c.name === channels[0] && c.type == "text");
    if (!textChannel) {
      console.log(textChannel);
      try {
        textChannel = await message.guild.channels.create(channels[0], {
          type: 'text',
          permissionOverwrites: [{
              id: client.user.id,
              allow: ['ADMINISTRATOR'],
            },
            {
              id: everyoneRole.id,
              deny: ['VIEW_CHANNEL'],
            },
          ],
        })
        textChannel.setParent(category.id);
      } catch (e) {
        console.log(e);
      };
    }

    let voiceChannel = message.guild.channels.cache.find(c => c.name === channels[1] && c.type == "voice");
    if (!voiceChannel) {
      try {
        voiceChannel = await message.guild.channels.create(channels[1], {
          type: 'voice',
          permissionOverwrites: [{
              id: client.user.id,
              allow: ['ADMINISTRATOR'],
            },
            {
              id: everyoneRole.id,
              deny: ['VIEW_CHANNEL'],
            },
          ],
        })
        voiceChannel.setParent(category.id);
      } catch (e) {
        console.log(e);
      };
    }

  }

  if(command === "check-my-role"){
    let role = await message.guild.roles.cache.find(r => r.name === "Test Role");
    console.log(role);
  }


  if (command === "join-nifty-discord") {
    const tokenId = args[0];
    if (tokenId == null) {
      message.reply("ERROR! Invalid arguments");
      return;
    }
    if (!message.guild) {
      message.channel.send('You must be in a guild!');
      return;
    }
    try {
      //get token owner
      const tokenOwner = await contractInstance.methods.ownerOf(tokenId).call();
      //fetch roles, permissions, channels corresponding to given tokenId
      const roleName = 'Test Role';
      const roleColor = 'Blue';
      const roleReason = 'we need a test role';
      const channels = ['nifty-discord-text', 'Nifty-Discord-Voice'];
      const categoryName = 'NIFTY-DISCORD-MEMBERS';
      //get the discord userID associated with given tokenId
      //const ownerUserID = '634339452474621952';
      //const ownerUserID = '680121617447125008';
      let ownerUserID = await contractInstance.methods.getTokenOwnerDiscordID(tokenId).call();
      //console.log(ownerUserID);
      //check if the message author's ID matches with ownerUserID
      if (message.author.id === ownerUserID) {
        //add role to the user;
        let role = await message.guild.roles.cache.find(r => r.name === roleName);
        if (!role) {
          try {
            role = await message.guild.roles.create({
              data: {
                name: roleName,
                color: roleColor
              },
              reason: roleReason
            })
          } catch (e) {
            console.log(e);
          }
        }
        let member = message.member;
        await member.roles.add(role);
        //add user to the channels
        const everyoneRole = await message.guild.roles.cache.find(r => r.name === '@everyone');
        //console.log(everyoneRole);

        let category = await message.guild.channels.cache.find(c => c.name == categoryName && c.type == "category");
        if (!category) {
          try {
            category = await message.guild.channels.create(categoryName, {
              type: 'category',
              permissionOverwrites: [{
                  id: client.user.id,
                  allow: ['ADMINISTRATOR'],
                },
                {
                  id: everyoneRole.id,
                  deny: ['VIEW_CHANNEL'],
                },
              ],
            })
          } catch (e) {
            console.log(e);
          };
        }

        let textChannel = message.guild.channels.cache.find(c => c.name === channels[0] && c.type == "text");
        if (!textChannel) {
          console.log(textChannel);
          try {
            textChannel = await message.guild.channels.create(channels[0], {
              type: 'text',
              permissionOverwrites: [{
                  id: client.user.id,
                  allow: ['ADMINISTRATOR'],
                },
                {
                  id: everyoneRole.id,
                  deny: ['VIEW_CHANNEL'],
                },
              ],
            })
            textChannel.setParent(category.id);
          } catch (e) {
            console.log(e);
          };
        }
        try {
          await textChannel.overwritePermissions([{
            id: message.author.id,
            deny: ['CREATE_INSTANT_INVITE'],
            allow: ['VIEW_CHANNEL']
          }]);
        } catch (e) {
          console.log(e);
        }

        let voiceChannel = message.guild.channels.cache.find(c => c.name === channels[1] && c.type == "voice");
        if (!voiceChannel) {
          try {
            voiceChannel = await message.guild.channels.create(channels[1], {
              type: 'voice',
              permissionOverwrites: [{
                  id: client.user.id,
                  allow: ['ADMINISTRATOR'],
                },
                {
                  id: everyoneRole.id,
                  deny: ['VIEW_CHANNEL'],
                },
              ],
            })
            voiceChannel.setParent(category.id);
          } catch (e) {
            console.log(e);
          };
        }
        try {
          await voiceChannel.overwritePermissions([{
            id: message.author.id,
            deny: ['SPEAK', 'STREAM', 'CREATE_INSTANT_INVITE'],
            allow: ['VIEW_CHANNEL', 'CONNECT']
          }]);
        } catch (e) {
          console.log(e);
        }

        message.reply(`congratulations! You have now access to NiftyDiscord members only chanels`);
      } else {
        message.reply("ERROR: your userID doesn't matche with the one associated with tokenId. Check your DM for more details");
        message.author.send("go to NiftyDiscordMembers website!");
      }

    } catch (e) {
      console.log(e)
    }
  }
});

client.login(config.BOT_TOKEN);
