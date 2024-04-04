const mineflayer = require("mineflayer");
const pathfinder = require("mineflayer-pathfinder").pathfinder;
const Movements = require("mineflayer-pathfinder").Movements;
const { GoalBlock, GoalXZ } = require("mineflayer-pathfinder").goals;

const config = require("./settings.json");

const loggers = require("./logging.js");
const logger = loggers.logger;

function createBot() {
  try {
    const bot = mineflayer.createBot({
      username: config["bot-account"]["username"],
      password: config["bot-account"]["password"],
      auth: config["bot-account"]["type"],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
      plugins: {},
    });

    const defaultMove = new Movements(bot);

    bot.once("spawn", () => {
      bot.settings.colorsEnabled = false;
      bot.loadPlugin(pathfinder);
      bot.pathfinder.setMovements(defaultMove);
      logger.info("Bot joined to the server");

      if (config.utils["auto-auth"].enabled) {
        logger.info("Started auto-auth module");

        let password = config.utils["auto-auth"].password;
        setTimeout(() => {
          bot.chat(`/register ${password} ${password}`);
          bot.chat(`/login ${password}`);
        }, 500);

        logger.info(`Authentication commands executed`);
      }

      if (config.utils["chat-messages"].enabled) {
        logger.info("Started chat-messages module");

        let messages = config.utils["chat-messages"]["messages"];

        if (config.utils["chat-messages"].repeat) {
          let delay = config.utils["chat-messages"]["repeat-delay"];
          let i = 0;

          setInterval(() => {
            bot.chat(`${messages[i]}`);

            if (i + 1 === messages.length) {
              i = 0;
            } else i++;
          }, delay * 1000);
        } else {
          messages.forEach((msg) => {
            bot.chat(msg);
          });
        }
      }

      bot.on("death", () => {
        logger.warn("Bot died");
        bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      });

      const pos = config.position;

      if (config.position.enabled) {
        logger.info(
          `Starting moving to target location (${pos.x}, ${pos.y}, ${pos.z})`
        );
        bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      //  if (config.utils["sleep"].enabled) {
      //  }

      if (config.utils["anti-afk"].enabled) {
        if (config.utils["anti-afk"].sneak) {
          bot.setControlState("sneak", true);
        }

        if (config.utils["anti-afk"].jump) {
          bot.setControlState("jump", true);
        }

        if (config.utils["anti-afk"]["hit"].enabled) {
          let delay = config.utils["anti-afk"]["hit"]["delay"];
          let attackMobs = config.utils["anti-afk"]["hit"]["attack-mobs"];

          setInterval(() => {
            if (attackMobs) {
              let entity = bot.nearestEntity(
                (e) =>
                  e.type !== "object" &&
                  e.type !== "player" &&
                  e.type !== "global" &&
                  e.type !== "orb" &&
                  e.type !== "other"
              );

              if (entity) {
                bot.attack(entity);
                return;
              }
            }

            bot.swingArm("right", true);
          }, delay);
        }

        if (config.utils["anti-afk"].rotate) {
          setInterval(() => {
            bot.look(bot.entity.yaw + 1, bot.entity.pitch, true);
          }, 100);
        }

        if (config.utils["anti-afk"]["circle-walk"].enabled) {
          let radius = config.utils["anti-afk"]["circle-walk"]["radius"];
          circleWalk(bot, radius);
        }
      }
    });
    bot.on("wake", () => {
      logger.info("Bot woke up");
    });

    bot.on("chat", (username, message) => {
      if (
        message === `${config["bot-account"]["username"]} sleep` ||
        message === "bots sleep"
      ) {
        sleep(bot);
      }
      if (config.utils["chat-log"]) {
        logger.info(`<${username}> ${message}`);
      }
    });

    bot.on("goal_reached", () => {
      if (config.position.enabled) {
        logger.info(`Bot arrived to target location. ${bot.entity.position}`);
      }
    });

    bot.on("death", () => {
      logger.warn(
        `Bot has been died and was respawned at ${bot.entity.position}`
      );
    });

    //   on chat command give bot stats about itself
    bot.on("chat", (username, message) => {
      if (message === `${config["bot-account"]["username"]} stats`) {
        bot.chat(`I am at ${bot.entity.position}`);

        const healthPorcentage = (bot.health / 20) * 100;
        const foodPorcentage = (bot.food / 20) * 100;

        bot.chat(
          `I have ${healthPorcentage}% of health and ${foodPorcentage}% of food`
        );
        bot.chat(`The time is ${bot.time.timeOfDay}`);
        bot.chat(`I'm level ${bot.experience.level}`);
      }
    });

    if (config.utils["auto-reconnect"]) {
      bot.on("end", () => {
        setTimeout(() => {
          createBot();
        }, config.utils["auto-reconnect-delay"]);
      });
    }

    //  TODO: Add resolve reason for kick
    bot.on("kicked", (reason) => {
      // let reasonText = JSON.parse(reason).text;
      // if (reasonText === "") {
      //   reasonText = JSON.parse(reason).extra[0].text;
      // }
      // reasonText = reasonText.replace(/§./g, "");

      // logger.warn(`Bot was kicked from the server. Reason: ${reasonText}`);
      createBot();
    });

    bot.on("error", (err) => logger.error(`${err.message}`));
  } catch (err) {
    createBot();
  }
}

function circleWalk(bot, radius) {
  // Make bot walk in square with center in bot's  wthout stopping
  return new Promise(() => {
    const pos = bot.entity.position;
    const x = pos.x;
    const y = pos.y;
    const z = pos.z;

    const points = [
      [x + radius, y, z],
      [x, y, z + radius],
      [x - radius, y, z],
      [x, y, z - radius],
    ];

    let i = 0;
    setInterval(() => {
      if (i === points.length) i = 0;
      bot.pathfinder.setGoal(new GoalXZ(points[i][0], points[i][2]));
      i++;
    }, 1000);
  });
}

async function sleep(bot) {
  if (config.utils["sleep"].enabled) {
    bed = bot.findBlock({
      maxDistance: 10,
      matching: (block) => bot.isABed(block),
    });

    if (bed) {
      try {
        await bot.sleep(bed);
        logger.info("Bot is sleeping");
      } catch (err) {
        if (err.message === "it's not night and it's not a thunderstorm") {
          bot.chat("It's day time, I can't sleep now.");
          return;
        } else if (err.message === "already sleeping") {
          bot.chat("I'm already sleeping.");
          return;
        } else if (err.message === "there are monsters nearby") {
          bot.chat("There are monsters nearby, I can't sleep now.");
          return;
        }
        logger.error(`Error while sleeping: ${err.message}`);
      }
    } else {
      logger.warn("No bed found");
    }
  }
}

createBot();
