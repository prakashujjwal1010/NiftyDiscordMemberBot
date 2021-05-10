const Discord = require("discord.js");
const config = require("./config.json");
const YourCollectible_ABI = require("./contracts/YourCollectible.abi.js");
const YourCollectible_address = require("./contracts/YourCollectible.address.js");
const Web3 = require("web3");
const {
  BufferList
} = require('bl')
const express = require('express');
const app = express();
const cors = require("cors");
const port = 3050;

app.use(
  cors()
);

app.use(express.json())

const client = new Discord.Client();
let clientReady = false;
const web3 = new Web3(new Web3.providers.HttpProvider("https://goerli.infura.io/v3/ecd9d1cce3ec4df498a1526dcb706d7a"));
const web3Socket = new Web3(new Web3.providers.WebsocketProvider("wss://goerli.infura.io/ws/v3/ecd9d1cce3ec4df498a1526dcb706d7a"));
const ipfsAPI = require('ipfs-http-client');
const ipfs = ipfsAPI({
  host: 'ipfs.infura.io',
  port: '5001',
  protocol: 'https'
})

const contractInstance = new web3.eth.Contract(YourCollectible_ABI, YourCollectible_address);
const contractSocketInstance = new web3Socket.eth.Contract(YourCollectible_ABI, YourCollectible_address);

const getFromIPFS = async hashToGet => {
  for await (const file of ipfs.get(hashToGet)) {
    //console.log(file.path)
    if (!file.content) continue;
    const content = new BufferList()
    for await (const chunk of file.content) {
      content.append(chunk)
    }
    //console.log(content)
    return content
  }
}

const handleEvents = async (tokenId, ownerUserID) => {
  if (clientReady) {
    let tokenURI = await contractInstance.methods.tokenURI(tokenId).call();
    const ipfsHash = tokenURI.replace("https://ipfs.io/ipfs/", "")
    const jsonManifestBuffer = await getFromIPFS(ipfsHash)
    try {
      const jsonManifest = JSON.parse(jsonManifestBuffer.toString())
      console.log("jsonManifest", jsonManifest)
      let guildID = await contractInstance.methods.getTokenCreatorGuildID(tokenId).call();
      const guild = await client.guilds.cache.get(guildID);
      const member = await guild.members.cache.get(ownerUserID);
      let roleName = jsonManifest.role;
      let role = guild.roles.cache.find(r => r.name === roleName);
      //let targetID = role ? role.id : ownerUserID;
      await member.roles.remove(role);
    } catch (e) {
      console.log(e)
      return;
    }
  }

}

contractSocketInstance.events.Transfer()
  .on('data', async (event) => {
    const returnValues = event.returnValues;
    console.log(returnValues);
    let ownerUserID = await contractInstance.methods.getTokenOwnerDiscordID(returnValues.tokenId).call();
    handleEvents(returnValues.tokenId, ownerUserID);
  })
  .on('error', console.error);


contractSocketInstance.events.AccessActivated()
  .on('data', async (event) => {
    const returnValues = event.returnValues;
    console.log(returnValues);
    console.log(returnValues.discordID.toString());
  })
  .on('error', console.error);

contractSocketInstance.events.AccessDeactivated()
  .on('data', async (event) => {
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

  if (command === "check-my-role") {
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
      //const tokenOwner = await contractInstance.methods.ownerOf(tokenId).call();
      let tokenStatus = await contractInstance.methods.getTokenStatus(tokenId).call();
      console.log(tokenStatus);

      if(tokenStatus != 1){
        message.reply("ERROR! The given NFT is archived and can't be used to access NiftyDiscord Membership");
        return;
      }
      //fetch roles, permissions, channels corresponding to given tokenId
      let roleName = 'Test Role';
      let roleColor = 'Blue';
      let roleReason = 'we need a new role';
      let channels = [
        {
          name: 'nifty-discord-text',
          type: 'text'
        },
        {
          name: 'Nifty-Discord-Voice',
          type: 'voice'
        }
      ];
      const categoryName = 'NIFTY-DISCORD-MEMBERS';
      let tokenURI = await contractInstance.methods.tokenURI(tokenId).call()
      //console.log(tokenURI);
      const ipfsHash = tokenURI.replace("https://ipfs.io/ipfs/", "")
      const jsonManifestBuffer = await getFromIPFS(ipfsHash)
      try {
        const jsonManifest = JSON.parse(jsonManifestBuffer.toString())
        console.log("jsonManifest", jsonManifest)
        roleName = jsonManifest.role;
        roleColor = jsonManifest.background_color;
        channels = jsonManifest.channels;
      } catch (e) {
        console.log(e)
        message.reply("ERROR! Retry")
        return;
      }
      //get the discord userID associated with given tokenId
      //const ownerUserID = '634339452474621952';
      //const ownerUserID = '680121617447125008';
      let ownerUserID = await contractInstance.methods.getTokenOwnerDiscordID(tokenId).call();
      //console.log(ownerUserID);
      //check if the message author's ID matches with ownerUserID
      console.log(ownerUserID);
      console.log(message.author.id);
      if (message.author.id === ownerUserID) {
        //add role to the user;
        console.log(roleName);
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
            message.reply("ERROR! Retry")
            return;
          }
        }
        let member = message.member;
        await member.roles.add(role);
        //add user to the channels
        const everyoneRole = await message.guild.roles.cache.find(r => r.name === '@everyone');

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
            message.reply("ERROR! Retry")
            return;
          };
        }

        for(channel in channels){
          let channelName = channel.name;
          if(channel.type == 'text'){
            let textChannel = message.guild.channels.cache.find(c => c.name === channelName);
            if (!textChannel) {
              console.log(textChannel);
              try {
                textChannel = await message.guild.channels.create(channelName, {
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
                message.reply("ERROR! Retry")
                return;
              };
            }
            try {
              await textChannel.overwritePermissions([{
                id: role.id,
                deny: ['CREATE_INSTANT_INVITE'],
                allow: ['VIEW_CHANNEL']
              }]);
            } catch (e) {
              console.log(e);
              message.reply("ERROR! Retry")
              return;
            }
          }

          if(channel.type == 'voice'){
            let voiceChannel = message.guild.channels.cache.find(c => c.name === channelName && c.type == "voice");
            if (!voiceChannel) {
              try {
                voiceChannel = await message.guild.channels.create(channelName, {
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
                message.reply("ERROR! Retry")
                return;
              };
            }
            try {
              await voiceChannel.overwritePermissions([{
                id: role.id,
                deny: ['SPEAK', 'STREAM', 'CREATE_INSTANT_INVITE'],
                allow: ['VIEW_CHANNEL', 'CONNECT']
              }]);
            } catch (e) {
              console.log(e);
              message.reply("ERROR! Retry")
              return;
            }

          }

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

app.get('/users', async (req, res) => {
  let guildID = await contractInstance.methods.getTokenCreatorGuildID(5).call();
  let guild = await client.guilds.cache.get(guildID)
  let userList = await guild.members.cache.map(m => m.user.tag).join(', ');
  console.log(userList);
  res.send(userList);
})

app.get('/api/guilds/:guildID/roles', async (req, res) => {
  const {
    guildID
  } = req.params;
  let guild = await client.guilds.cache.get(guildID)
  let roles = await guild.roles.cache;
  roles.sort((a, b) => b.comparePositionTo(a));
  roles = roles.array();
  roles.forEach((item, i) => {
    item.rank = i;
    item.permissionsArray = item.permissions.toArray();
  });
  roles = roles.filter(a => (a.name != "@everyone" && a.managed != true));
  //console.log(roles);
  res.send(roles);
})

app.get('/api/guilds/:guildID/channels', async (req, res) => {
  const {
    guildID
  } = req.params;
  let guild = await client.guilds.cache.get(guildID)
  let channels = await guild.channels.cache.array();
  //console.log(channels);
  res.send(channels);
})


app.listen(port, () => {
  console.log(`Starting express serve at ${port}`);
});

client.login(config.BOT_TOKEN);
