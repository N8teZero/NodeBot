"use strict";

/*
*   NodeBot
*   Plug.dj NodeJS Moderation Bot
*   NodeJS framework based on AuirBot by Zeratul0.
*/

const plugLogin = require('plug-login');

const TITLE = 'NodeBot';
const VER = '4.20.06';
const STARTTIME = Date.now();

let me = {};  //your user data, grabbed each time you join a room
let seen = {};  //holds user records, gets populated with data/seenUsers.json
let MEMORY = {rss:0, heapTotal:0, heapUsed:0};  //memory usage

const BotSettings = {
    
    doJoinMessage:false, //if true, sends a message upon joining a room
    autoWoot:true,
    maxLength:600, // 10 minutes
    welcomeUsers:true, //welcomes users joining the room    
    seenAutoSave:true,  //saves user records to data/seenUsers.json every 10 minutes


    "loadFromFile":()=>{
        if (!EXTERNALSETTINGS) return;
        fs.readFile('settings.json', (e,data)=>{
            if (e) error(cc.red(e));
            else {
                try { JSON.parse(data); } catch (err) { error(cc.red('There was an error parsing the settings file.')); error(err); return; };
                if (JSON.parse(data)) {
                    let i;
                    
                    data = JSON.parse(data);
                    for (i in data) {
                        if (i.substr(0,1) !== '_') {
                            if (BotSettings.hasOwnProperty(i) && typeof BotSettings[i] === typeof data[i]) {
                                if ((i === 'promptColor' || i === 'timestampColor') && !cc[data[i]]) {
                                    error(cc.red('settings.json: ')+cc.redBright(i)+cc.red(' does not have a valid color name.'));
                                } else if ((i === 'announcementInterval' || i === 'motdInterval') && (typeof data[i] !== "number" || data[i] < 5000)) {
                                    error(cc.red('settings.json: ')+cc.redBright(i)+cc.red(' does not have a valid amount. Must be 5000+.'));
                                } else BotSettings[i] = data[i];
                            }
                        }
                    }
                    BotSettings._fn.apply();
                    log(cc.blueBright('settings.json loaded.'));
                }
            }
        });
    }
};
let PROMPT = cc[BotSettings.promptColor]('$ ');
const LOGTYPES = {
    WAITLIST:cc.blueBright('[waitlist] '),
    SKIP:cc.yellowBright('[skip] '),
    WOOT:cc.greenBright('[woot] '),
    WOOTAGAIN:cc.green('[woot] '),
    GRAB:cc.magentaBright('[grab] '),
    GRABAGAIN:cc.magenta('[grab] '),
    MEH:cc.redBright('[meh] '),
    MEHAGAIN:cc.red('[meh] '),
    GIFT:cc.blue('[gift] '),
    USER:cc.blueBright('[user] '),
    NOTIFY:cc.yellowBright('[notify] '),
    KILLSESSION:cc.redBright('[killSession] '),
    STAFF:cc.magentaBright('[staff] '),
    DELETE:cc.redBright('[delete] '),
    ROOM:cc.blue('[room] '),
    JOIN:cc.green('[join] '),
    LEAVE:cc.red('[leave] '),
    FRIEND:cc.cyanBright('[friend] '),
    PLUG:cc.cyanBright('[plug.dj] '),
    BAN:cc.redBright('[ban] '),
    MUTE:cc.yellow('[mute] '),
}
const REASONS = [
    { // ban reasons
        1:'Spamming or trolling',
        2:'Verbal abuse or offensive language',
        3:'Playing offensive videos/songs',
        4:'Repeatedly playing inappropriate genre(s)',
        5:'Negative attitude'
    },
    { // mute reasons
        1:'Violating community rules',
        2:'Verbal abuse or harassment',
        3:'Spamming or trolling',
        4:'Offensive language',
        5:'Negative attitude'
    }
];
const DURATIONS = [
    {   //ban durations
        'h':'One hour',
        'd':'One day',
        'f':'Forever'
    },
    {   //mute durations
        's':'15 minutes',
        'm':'30 minutes',
        'l':'45 minutes'
    }
];

function validateTrigger() {
    if (typeof TRIGGER !== "string" || TRIGGER.length !== 1 || !~'!#$%^&*()_+-=`~.,?'.indexOf(TRIGGER)) {
        TRIGGER = '!';
        error(cc.red("Invalid trigger found. Reverted trigger to ") + cc.redBright("!"));
    }
}

function login() {
    
    if (!HOME || HOME.trim() === '') {
        return console.log('\n' + cc.redBright("HOME is not defined! You must specify a roomslug for HOME within coreOptions.js, which is the room joined upon logging in. A roomslug is what's found at the end of a plug.dj room's URL.\nPress CTRL+C or close the window to exit."));
    } else if (HOME === '-8299715266665171479') {
        console.log('\n' + cc.yellowBright("HOME is set to -8299715266665171479, the default placeholder room. Change it within coreOptions.js to set the default room the bot joins upon logging in."));
    }
    
    const pluglogin = function(u,p,isAuto) {
        
        plugLogin.user(u, p, {authToken: true}, (err, res) => {
            u = p = "";
            if (err) {login((isAuto ? cc.red("\nAuto login failed. Check your userdata.js.\n") : '') + cc.redBright('ERROR: ' + err.message + (err.status === "notAuthorized" ? '\nDid you incorrectly type your username or password?' : '')));}//throw err;
            else {
                sessJar = res.jar;
                connect(res.token);
            }
        });
    };

    setTitle(false);
    startTimer("memory");

function doChatCommand(data, user) {
    if (BotSettings.allowChatCommands && data['message'] && ~user) {
        if (typeof user.username === "string")
            user.username = ent.decode(user.username);
        
        let splitMessage = data.message.trim().split(' ');
        let cmdname = splitMessage[0].substr(1).toLowerCase();
        if (BotSettings.messageCommands && BotSettings.useMessageCommands && BotSettings.messageCommands[cmdname] && typeof BotSettings.messageCommands[cmdname] === "string") {sendMessage(BotSettings.messageCommands[cmdname], 500); return;}
        if (!user.hasOwnProperty('role')) return;
        var role = user.role;
        if (user.hasOwnProperty('gRole')) {
            if (user.gRole === 3) role = 6;
            else if (user.gRole === 5) role = 7;
        }
        const simpleGetName = function() {
            const pos = data.message.indexOf('@');
            let toUser = "";
            if (!~pos) {
                if (splitMessage.length === 1)
                    toUser = me.username;
            } else {
                toUser = data.message.substr(pos+1).trim();
            }
            return toUser;
        };
        const cmds = {
            'about':()=>commands.about.exec(role),
            'dc':()=>commands.dc.exec(role, user.username, user.id),
            'skip':()=>{
                if (splitMessage.length > 1) commands.skip.exec(role, user.username, splitMessage[1].toLowerCase());
                else commands.skip.exec(role, user.username, "none");
            },
            'uptime':()=>commands.uptime.exec(role)
        };
        cmds['ut'] = cmds.uptime;
        return (cmds[cmdname] || function() {})();
    }
}

commands['about'] = new Command(true,0,"about :: Displays bot's \"about\" message. Any rank.",function() {
    if (arguments.length !== 1) return;
    sendMessage("About :: " + TITLE + " v" + VER + " :: by N8te- :: https://github.com/N8teZero");
});

commands['dc'] = new Command(true,0,"dc :: Places you back into the waitlist at your old position ONLY IF you were disconnected while waiting. Any rank. Must be " + secsToLabelTime(MAX_DISC_TIME, true) + " since disconnecting.",function() {
    cleanDC();
    let username = arguments[1],
        id = parseInt(arguments[2]),
        time = Date.now(),
        record = -1,
        pos = -1,
        lastPos = -1;
        
    if (!isNaN(id)) {
        record = getUserRecord(id);
        pos = getWaitlistPos(id);
        lastPos = getUserDC(id);
    }
    
    if (typeof id === "undefined" || typeof username === "undefined") return;
    if (~record) {
        if (typeof MAX_DISC_TIME === "number" && MAX_DISC_TIME > 1000) {
            let dur = (time - record.lastDisconnect);
            if (record.lastDisconnect <= 0) return;
            else if (lastPos >= 0 && (!~pos || pos > lastPos)) {
                if (dur > MAX_DISC_TIME)
                    sendMessage("[@" + username + "] You disconnected too long ago. Last disconnect: " + secsToLabelTime(time - record.lastDisconnect, true) + " ago.");
                else if ((time - record.lastDisconnect) <= MAX_DISC_TIME) {
                    sendMessage("[@" + username + "] Disconnected " + secsToLabelTime(time - record.lastDisconnect, true) + " ago, previously at position " + (lastPos+1) + ". Bumped in the waitlist.");
                    addUserToWaitlist(id, function() {
                        moveDJ(id, lastPos);
                        remUserDC(id);
                    });
                }
            } else if (!~lastPos) {
                sendMessage("[@" + username + "] Could not find a previous waitlist position for you. If you did disconnect, the waitlist may have fully cycled while you were gone.");
            }
        }
    } else {
        error(cc.red(TRIGGER + "dc :: Could not find user's seendata. username: " + username + ", id: " + id + ", room.slug: " + room.slug));
    }
});

commands['skip'] = new Command(true,2,"skip [reason] :: Skips current song with optional reason, if valid. Bouncer+.",function() {
    if (arguments.length !== 3) return;
    if (arguments[2] && (arguments[2].toLowerCase() === "t" || arguments[2].toLowerCase() === "r" || arguments[2].toLowerCase() === "o" || arguments[2].toLowerCase() === "l" || arguments[2].toLowerCase() === "s")) {
        let arg = arguments[2].toLowerCase();
        let sReason = null;
        let posReturn = null;
        if (arg === "t") {
            sReason = "theme";
            posReturn = true;
        } else if (arg === "r") {
            sReason = "repeat";
            posReturn = false;
        } else if (arg === "o") {
            sReason = "op";
            posReturn = true;
        } else if (arg === "l") {
            sReason = "language";
            posReturn = true;
        } else if (arg === "s") {
            sReason = "sound";
            posReturn = true;
        }
        skipSong(arguments[1], sReason, false, posReturn);
    } else {
        return;
    }
});

commands['uptime'] = new Command(true,0,"uptime :: Returns uptime of this bot. Any rank.",function() {
    if (STARTTIME) {
        let uptime = secsToLabelTime(Date.now() - STARTTIME, true);
        let sndmsg = "Bot uptime: " + uptime;
        sendMessage(sndmsg);
    }
});


if (EXTERNALSETTINGS)
    BotSettings._fn.loadFromFile();
else
    BotSettings._fn.apply();

fs.readFile('data/seenUsers.json', (e,data)=>{if (e) return; else if (data && data+"" !== "") {seen = JSON.parse(data+""); startTimer("seen");}});

login();