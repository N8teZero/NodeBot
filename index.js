"use strict";

/*
*   RoboTHC
*   Plug.dj NodeJS Moderation Bot
*   NodeJS framework based on AuirBot by Zeratul0.
*/

const cc = require('cli-color');
const fs = require('graceful-fs');
const ent = require('html-entities').XmlEntities;
const req = require('request');
const WebSocket = require('ws');
const plugLogin = require('plug-login');
const util = require('util');
const readline = require('readline');

const userdata = function() {
    try {
        const data = require('./userdata.js');
        if (data.username && data.username.trim() !== "" && data.password && data.password.trim() !== "")
            return data;
    } catch (e) {
        if (e.code !== "MODULE_NOT_FOUND")
            error(cc.red(e));
    }
    return null;
};
const core = require('./coreOptions.js');

const HOME = core.HOME;
const STARTASNORMALUSER = core.STARTASNORMALUSER;
const EXTERNALSETTINGS = core.EXTERNALSETTINGS;
const blacklists = core.blacklists;
const DEBUG = core.DEBUG;
const YTAPI = core.YTAPI;
const SCAPI = core.SCAPI;
let TRIGGER = core.TRIGGER;

const cleverbot = require("cleverbot.io"),
cb = new cleverbot(core.CBUSER, core.CBKEY);
const PLATFORM = ((process && process.platform) ? process.platform : "win32");  //host platform OS identifier string
const TITLE = 'RoboTHC';
const VER = '4.20.05';
const STARTTIME = Date.now();
const MAX_DISC_TIME = 3600000;  //1 hour; MUST keep above 1000ms; time after a user disconnects when they can use !dc
const commands = {};  //holds chat commands, defined at the bottom
const HEARTBEAT = {  //heartbeat
    last: 0,
    timer: null
};

let HIGHWAY = 21; // space in chat between UID/CID and username where user symbols are placed. don't change

//*TIME: timers
let MEMORYTIME = null;
let SAVESEENTIME = null;
let AFKCHECKTIME = null;
let AUTODISABLETIME = null;
let ANNOUNCEMENTTIME = null;
let MOTDTIME = null;
let STUCKSKIPTIME = null;
let wss = null;  //websocket
let room = null;  //room
let MENTIONREGEX = null;  //regex for mentions in chat, see handleChat
let DIDAUTOLOGIN = false;

let sessJar = {};  //user session jar generated on login
let me = {};  //your user data, grabbed each time you join a room
let seen = {};  //holds user records, gets populated with data/seenUsers.json
let disconnects = {};  //holds disconnect time/last waitlist position if someone leaves while on the waitlist
let MEMORY = {rss:0, heapTotal:0, heapUsed:0};  //memory usage
let LASTSENTMSG = 0;  //last sent message
let STARTEDINPUT = false;  //don't change
const constSettings = ["announcements", "messagecommands", "eightballchoices", "_fn", "skipreasons"];
let sentAnnouncements = [];

const BotSettings = {
    
    doJoinMessage:false, //if true, sends a message upon joining a room; ":: AiurBot vx.xx loaded ::"
    
    autoWoot:true,
    maxLength:600, // 10 minutes
    
    welcomeUsers:true, //welcomes users joining the room
    
    timestampUse:true,  //show timestamp in console
    timestampSeconds:true,  //show seconds on timestamp
    timestampTwelveHours:false, //if true, shows timestamp in 12h format instead of 24h
    timestampColor:'cyan',  //color of timestamp
    
    titleShowRoom:true,     //show current room in title
    titleShowMemory:true,   //show memory usage in title
    titleShowUsers:true,    //show user count in title
    
    chatHighlightMention:true,  //use @ highlights
    chatShowCID:true,       //shows full CID of chat message; if false, just shows UID
    chatShowWoot:false,
    chatShowRepeatWoot:true,
    chatShowGrab:true,
    chatShowRepeatGrab:true,
    chatShowMeh:true,
    chatShowRepeatMeh:true,
    chatDeleteTriggerMessages:true,  //delete ALL messages beginning with TRIGGER 1 second after they are sent
    chatDeleteResponses:true,   //delete afkdisable/joindisable response messages 1 second after they are sent
    promptColor:'redBright',  //color of $ on the cmd prompt
    
    seenAutoSave:true,  //saves user records to data/seenUsers.json every 10 minutes
    
    acceptRemoteCmd:false,  //allow bot creator to use local commands from the chat
    allowRemoteBlacklistEdit:true,  //if true, allow "blacklist" command (that command must also be enabled to use it)
    
    announcementInterval: 540000, //ms; 9 minutes
    announcementRandom:false,   //if true, picks random announcements instead of going in order
    sendAnnouncements:true,    //if true, send announcements. if false, it's off
    
    allowChatCommands:true,  //if false, prevents any chat command from being used
    useMessageCommands:true,  //if true, allows users to use messageCommands below
    
    doAFKCheck:true,  //if true, removes users from the waitlist if they have not sent a chat message in 2 hours
    
    doLotto:true,  //if true, automatically starts lotto at given interval
    lottoInterval:2700000,  //ms 45 minutes
    
    doAutoDisable:true,  //if true, sends !joindisable and !afkdisable every hour
    
    autoStuckSkip:true, //if true, skips songs 30 seconds after their length if they are stuck.
    
    doSkipCheck:true,  //if true, checks skip conditions when a new song is played, but doesn't skip. MUST BE true for doAutoSkip to work; exists only to avoid using soundcloud/youtube APIs for checking unavailability if unnecessary
    doAutoSkip:true,  //if true, skips songs if they meet skip conditions. doSkipCheck MUST BE true
    doHistorySkip:false, //if true, skips songs that are in the history. doSkipCheck MUST BE true
    hostBypassAutoSkip:true,  //if true, allows the host of the room to bypass autoskip conditions, unless the video is unavailable

    cleverbot:false,  //if true, enables cleverbot integration
    
    sendMOTD:false,  //if true, sends motd after each motdInterval
    motdInterval: 1800000, //ms; 30 minutes
    motd:"",  //motd message to send
    
    announcements:[
        //"announcements are comprised simply of strings. these will be cycled through and sent whenever the announcementInterval passes.",
        //"second announcement here"
        //...
    ],
    messageCommands:{
        //"name of command (make sure it has no spaces and does not conflict with an existing command!)" : "this will be sent in chat",
        //"messagecmd2":"output this"
        //...
    },
    skipReasons:{
        //"reason" : "message that is sent",

    },
    eightBallChoices:[
        //
    ],
    '_fn': {
        "apply":()=>{
            let j;
            PROMPT = cc[BotSettings.promptColor]('$ ');
            if (STARTEDINPUT) {
                rl.setPrompt(PROMPT + cc.blackBright('[chat] '), 2);
            }
            if (BotSettings.chatShowCID)
                HIGHWAY = 36;
            else
                HIGHWAY = 21;
            for (j of ["memory", "seen", "lotto", "announcements", "MOTD"]) {
                startTimer(j);
            }
            setTitle();
            sentAnnouncements = [];
            validateTrigger();
        },
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
        },
        'listSettings':()=>{
            let x = [],
                i;
            for (i in BotSettings) {
                if (i.substr(0,1) !== '_' && !~arrFind(constSettings, i.toLowerCase())) {
                    x.push(cc.green(i));
                }
            }
            nodeLog(cc.greenBright('List of bot options:')+' '+x.join(cc.blackBright(", ")));
        },
        'printSettings':()=>{
            let i,
                val;
            info(cc.cyanBright("OPTION") + cc.cyan(" | ") + cc.cyanBright("VALUE"));
            for (i in BotSettings) {
                if (i.substr(0,1) !== '_') {
                    if (typeof BotSettings[i] === "object")
                        val = "[This is an ARRAY or OBJECT]";
                    else
                        val = BotSettings[i];
                    info(cc.blueBright(i) + " " + cc.blue(val));
                }
            }
        },
        'changeSetting':(key,value)=>{
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            if (~arrFind(constSettings, key.toLowerCase())) {
                error(cc.redBright(key) + cc.red(" cannot be changed."));
                return;
            } else {
                let i;
                for (i in BotSettings) {
                    if (i.substr(0,1) !== '_' && i.toLowerCase() === key.toLowerCase()) {
                        if (strIsNum(value)) value = parseInt(value);
                        if (typeof value === typeof BotSettings[i]) {
                            if (i === 'promptColor' || i === 'timestampColor')
                                if (!cc[value]) {
                                    error(cc.redBright(value)+cc.red(' is not a valid color name.'));
                                    return;
                                }
                            if (i === 'announcementInterval' || i === 'motdInterval')
                                if (value < 5000) {
                                    error(cc.redBright(value)+cc.red(' is not a valid interval amount. Must be 5000+.'));
                                    return;
                                }
                            if (i === 'motd') {
                                
                            }
                            BotSettings[i] = value;
                            if (i === 'promptColor') {
                                PROMPT = cc[BotSettings.promptColor]('$ ');
                                if (STARTEDINPUT)
                                    rl.setPrompt(PROMPT + cc.blackBright('[chat] '), 2);
                            } else if (i === 'chatShowCID') {
                                if (value)
                                    HIGHWAY = 36;
                                else
                                    HIGHWAY = 21;
                            } else if (i === 'titleShowMemory') {
                                setTitle();
                                startTimer("memory");
                            } else if (i === 'titleShowRoom' || i === 'titleShowUsers') {
                                setTitle();
                            } else if (i === 'seenAutoSave') {
                                startTimer("seen");
                            } else if (i === 'doLotto') {
                                startTimer("lotto");
                            } else if (i === 'sendAnnouncements' || i === 'announcementInterval') {
                                startTimer("announcements");
                            } else if (i === 'sendMOTD' || i === 'motdInterval') {
                                startTimer("MOTD");
                            } else if (i === 'doAutoDisable') {
                                startTimer("autodisable");
                            }
                            nodeLog(cc.greenBright(i) + cc.green(' changed value to ') + cc.greenBright(value));
                        } else if (typeof value !== typeof BotSettings[i]) {
                            error(cc.redBright(value)+cc.red(' is not a valid datatype for ')+cc.redBright(i));
                        } return;
                    }
                }
            }
        }
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

function loadBlacklists() {
    
    let i,
        item,
        list;
        
    const LOAD = function(name, item) {
        fs.readFile(item[0], (e,data)=>{
            if (e) console.log(cc.red("loadBlacklist: ") + cc.redBright(e));
            else {
                data+="";
                
                let action = function(parsedData) {
                    blacklists[name][1] = parsedData;
                    console.log(cc.green('Successfully loaded blacklist "') + cc.greenBright(name) + cc.green('"'));
                };
                
                try {
                    list = JSON.parse(data);
                    action(list);
                } catch (err) {
                    console.log(cc.red('There was an error parsing a blacklist file: ') + cc.redBright(item[0]));
                    if (err.stack) console.log(cc.red(err.stack));
                }
            }
        });
    };
        
    for (i in blacklists) {
        item = blacklists[i];
        if (i.trim() !== "" && item.length === 2 && item[0] && typeof item[0] === "string" && /^blacklists\/.+?\.json$/gi.test(item[0])) {
            LOAD(i, item);
        } else {
            console.log(cc.red('Error loading blacklists.'));
        }
    }
}

function saveBlacklist(name) {
    if (blacklists.hasOwnProperty(name) && typeof blacklists[name][0] === "string" && /^blacklists\/.+?\.json$/gi.test(blacklists[name][0]) && Object.prototype.toString.apply(blacklists[name][1]) === "[object Array]") {
        fs.writeFile(blacklists[name][0], JSON.stringify(blacklists[name][1]), (e)=>{
            if (e) error(cc.red("Cannot write blacklist " + name + ": " + e.stack));
            else nodeLog(cc.green("Successfully saved blacklist \"" + name + "\""));
        });
    }
}

function setTitle() {
	let title = "";
    if (me && me.username)
        title += ent.decode(me.username) + ' | ';
    title += TITLE + ' ' + VER;
    if (room && room['slug']) {
		if (BotSettings.titleShowRoom)
        	title += ' | room: ' + room['slug'];
		if (BotSettings.titleShowUsers)
			title += ' | ' + room.userlist.length + ((room.userlist.length !== 1) ? " Users (" : " User (") + getAFK().length + " AFK" + ((room.meta.guests > 0) ? ", " + room.meta.guests + ((room.meta.guests !== 1) ? " guests" : " guest") : "") + "), Waitlist: " + room.getWaitlist().length;
	}
    if (MEMORY['heapUsed'] >= 0 && BotSettings.titleShowMemory)
        title += ' | Mem: ' + Math.ceil(MEMORY.heapUsed / 1024) + 'K'; //is this accurate?
    
    if (PLATFORM === "linux")
        process.stdout.write("\x1B]0;" + title + "\x07");
    else
        process.title = title;
    return void (0);
}

/*function canDoStaffAction(role, cmdname) {
    if (room && me && me.role) {
        const role = parseInt(role);
        if (isNaN(role)) return false;
        else {
            if (me.role >= role) {
                return true;
            } else {
                let msg = cc.red('Unauthorized');
                if (cmdname) msg += cc.red(' for command: ')+cc.redBright(cmdname);
                msg += cc.red('. Needs role ')+cc.cyanBright(roleToString(role) + '(' + role + ')') + cc.red(', you are ') + cc.cyanBright(roleToString(me.role) + '(' + role + ')')+cc.red('.');
                error(msg);
            }
        }
    }
    return false;
} UNUSED*/

function POST(endpoint, data, callback) {
    req.post('https://plug.dj/'+endpoint, {json: true, jar: sessJar, body: data}, function(e,r,b) {
        if (e) error(cc.red("POST ERROR: (" + endpoint + "): " + e));
        else if (b && typeof callback === "function") callback(b);
    });
}

function PUT(endpoint, data, callback) {
    req.put('https://plug.dj/'+endpoint, {json: true, jar: sessJar, body: data}, function(e,r,b) {
        if (e) error(cc.red("PUT ERROR: (" + endpoint + "): " + e));
        else if (b && typeof callback === "function") callback(b);
    });
}

function GET(endpoint, callback) {
    req.get('https://plug.dj/'+endpoint, {jar: sessJar, json: true}, function(e,r,b) {
        if (e) error(cc.red("GET ERROR: (" + endpoint + "): " + e));
        else if (b && typeof callback === "function") callback(b);
    });
}

function DELETE(endpoint, callback) {
    req.del('https://plug.dj/'+endpoint, {jar: sessJar, json: true}, function(e,r,b) {
        if (e) error(cc.red("DELETE ERROR: (" + endpoint + "): " + e));
        else if (b && typeof callback === "function") callback(b);
    });
}

let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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
                if (STARTASNORMALUSER) {
                    let i,
                        settingsToDisable = ["doJoinMessage", "allowChatCommands", "welcomeUsers", "chatDeleteTriggerMessages", "chatDeleteResponses", "acceptRemoteCmd", "sendAnnouncements", "useMessageCommands", "doAFKCheck", "doLotto", "doAutoDisable", "doAutoSkip", "sendMOTD", "autoStuckSkip", "allowRemoteBlacklistEdit"];
                    for (i = 0; i < settingsToDisable.length; i++) {
                        BotSettings[settingsToDisable[i]] = false;
                    }
                }
            }
        });
    };

    setTitle(false);
    startTimer("memory");

    if (arguments[0])
        console.log(arguments[0]);
    
    if (!DIDAUTOLOGIN) {
        const ud = userdata();
        if (ud) {
            DIDAUTOLOGIN = true;
            return pluglogin(ud.username, ud.password, true);
        }
    }

    console.log(cc.redBright('\n-- plug.dj login --\n'));
    let username = "";
    let password = "";
    rl.history = [];
    rl.question(PROMPT + cc.red('[INSECURE] ') + cc.blackBright('Email Address: '), function(un) {
        username = un;
        //http://stackoverflow.com/questions/24037545/how-to-hide-password-in-the-nodejs-console -- referred to Hors Sujet's answer for the password prompt
        process.stdin.on('data', function pwf(data) {switch (data + "") { case '\n':case '\r':case '\u0004':process.stdin.removeListener('data', pwf); rl.history = []; break; default: process.stdout.write('\u001b[2K\u001b[200D' + PROMPT + cc.blackBright('           Password: ') + '*'.repeat(rl.line.length)); break;}});
        rl.question(PROMPT + cc.blackBright('           Password: '), function(pw) {
            rl.history = [];
            password = pw;
            console.log('');
            pluglogin(un, pw, false);
        });
    });

}

function joinRoom(roomslug) {
    if (room) room.lotto._cleanup();
    clearInterval(SAVESEENTIME);
    clearInterval(AFKCHECKTIME);
    clearInterval(AUTODISABLETIME);
    clearTimeout(ANNOUNCEMENTTIME);
    clearTimeout(HEARTBEAT.timer);
    clearTimeout(MOTDTIME);
    const prevRoom = room;
    room = null;
    POST('_/rooms/join', {slug: roomslug}, (data)=>{
        if (data.status !== "ok") {
            error(cc.red("Error joining room: ") + cc.redBright(data.status));
            if (prevRoom) joinRoom(prevRoom.slug);
            return;
        }
        console.log('\n'+cc.blackBright('-'.repeat(process.stdout.columns)));
        console.log(cc.magentaBright('Joined room: ') + cc.blackBright('https://plug.dj/') + cc.redBright(roomslug));
        room = new Room(roomslug);
        GET('_/rooms/state', (data)=>{
            const body = data.data[0],
                myRole = body.role;
            let i;
            for (i in body.users) {
                body.users[i]['lastActivity'] = Date.now();
                body.users[i]['isAFK'] = false;
                body.users[i]['warn'] = 0;
                if (body.users[i].id) {
                    addSeenUser(body.users[i].id);
                    if (seen[room.slug] && seen[room.slug][body.users[i].id]) {
                        seen[room.slug][body.users[i].id].lastWelcome = Date.now();
                    }
                }
            }
            room.userlist = body.users;
            room.setPlaybackFromState(body);
            room.booth = body.booth;
            room.meta = body.meta;
            room.meta.description = ent.decode(room.meta.description.trim());
            room.meta.welcome = ent.decode(room.meta.welcome.trim());
            room.meta.name = ent.decode(room.meta.name.trim());
            room.meta.hostName = ent.decode(room.meta.hostName);
            room.votes = body.votes;
            room.grabs = body.grabs;
            if (room.meta.welcome)
                console.log('\n\n' + timestamp() + cc.blueBright('/// ') + cc.greenBright(room.meta.welcome.trim()) + cc.blueBright(' ///'));
            if (body['playback']['media'] && body['booth']['currentDJ']) {
                let unm = getUser(body.booth.currentDJ);
                if (!~unm) unm = cc.cyan('(unavailable)');
                else unm = colorizeName(unm);
                console.log('\n');
                log(cc.blue('/////////// ') + cc.blueBright('Playing') + cc.blue(' ::: ') + cc.cyanBright(body.playback.media.author) + cc.cyan(' - ') + cc.cyanBright(body.playback.media.title) + cc.blue(' | ') + cc.blueBright(secsToTime(body.playback.media.duration)) + cc.blue(' | ') + cc.blueBright('current DJ: ') + unm + cc.blue(' ///////////')+'\n\n');
            }
            else {
                console.log('\n');
                log(cc.blue('/////////// ') + cc.cyanBright('Nothing is currently playing.') + cc.blue(' ///////////')+'\n\n');
            }
            GET('_/playlists', (data)=>{
                const body = data.data;
                let i;
                room.playlists = body;
                for (i = 0; i < body.length; i++) {
                    if (body[i].active) {
                        room.activePlaylist = body[i];
                        break;
                    }
                }
                GET('_/rooms/history', (data)=>{
                    const body = data.data;
                    let i;
                    for (i in body) {
                        const item = body[i];
                        addHistoryItem(item.id, item.media.format, item.media.cid, item.timestamp);
                    }
                    GET('_/users/me', (data)=>{
                        me = data.data[0];
                        me.role = myRole;
                        addUser(me);
                        addSeenUser(me.id);
                        if (typeof me.username === "string")
                            me.username = ent.decode(me.username);
                        if (seen && seen[room.slug] && seen[room.slug][me.id]) { seen[room.slug][me.id].lastWelcome = Date.now(); }
                        displayUsers();
                        displayWaitlist();
                        if (BotSettings.autoWoot)
                            setTimeout(()=>{if (room) room.woot()},2000);
                        startTimer("afk");
                        startTimer("autodisable");
                        BotSettings._fn.apply();
                        startInput();
                        setTitle();
                        updateMentionRegex();
                        if (BotSettings.doJoinMessage) {
                            sendMessage(":: " + TITLE + ' ' + VER + " loaded ::", 2000);
                        }
                    });
                });
            });
        });
    });
}

function startTimer(type) {
    switch (type) {
        case "afk":
            clearInterval(AFKCHECKTIME);
            if (room) {
                AFKCHECKTIME = setInterval(function() {
                    if (!room) {
                        clearInterval(AFKCHECKTIME);
                    } else {
                        let i;
                        for (i in room.userlist) {
                            let user = room.userlist[i];
                            //10 minutes
                            if (!user.isAFK && (Date.now() - user.lastActivity) >= 600000) { 
                                room.userlist[i].isAFK = true;
                            } else if (me.role >= 2 && BotSettings.doAFKCheck && user.isAFK && (Date.now() - user.lastActivity) >= 7200000 && ~getWaitlistPos(user.id)) {
                                room.userlist[i].warn++;
                                let warns = room.userlist[i].warn;
                                warn(cc.yellow("[AFK Check]" + user.username + " has been AFK for at least 2 hours and is on the waitlist. Now has " + warns + " warn(s)."));
                                if (warns === 1) {
                                    sendMessage("[AFK Check] [@" + user.username + "] AFK Time: " + secsToLabelTime((Date.now() - user.lastActivity),true) + " - Chat soon or you will be removed from the waitlist.", 500);
                                } else if (warns === 2) {
                                    sendMessage("[AFK Check] [@" + user.username + "] Chat soon to avoid removal from the waitlist. Last warning.", 500);
                                } else if (warns >= 3) {
                                    removeUserFromWaitlist(user.id, function() {
                                        if (warns === 3) sendMessage("[AFK Check] @" + user.username + " Removed. Chat every two hours to stay in the waitlist.", 500);
                                        else if (warns > 3) sendMessage("[AFK Check] @" + user.username + ", you've been AFK for " + secsToLabelTime((Date.now() - user.lastActivity),true) + " and removed " + (warns-2) + " time(s). Send a message once every two hours to avoid removal.", 500);
                                    });
                                }
                            }
                        }
                        if (BotSettings.titleShowUsers)
                            setTitle();
                    }
                }, 60000);
            }
            break;
        case "seen":
            clearInterval(SAVESEENTIME);
            if (room && BotSettings.seenAutoSave) {
                SAVESEENTIME = setInterval(function() {
                    if (!BotSettings.seenAutoSave || !room) {
                        clearInterval(SAVESEENTIME);
                    } else {
                        activeChecks();
                        if (seen && seen !== {}) {
                            fs.writeFile('data/seenUsers.json', JSON.stringify(seen), (e)=>{
                                if (e)
                                    error(cc.red(e));
                                else
                                    nodeLog(cc.blueBright('data/seenUsers.json saved'));
                            });
                        } else {
                            error(cc.red("Seen user records were not saved because they are empty."));
                        }
                    }
                }, 600000);
            }
            break;
        case "memory":
            clearInterval(MEMORYTIME);
            if (BotSettings.titleShowMemory) {
                MEMORYTIME = setInterval(function() {
                    if (!BotSettings.titleShowMemory) {
                        clearInterval(MEMORYTIME);
                    } else {
                        MEMORY = process.memoryUsage();
                        setTitle(true);
                    }
                }, 3000);
            }
            break;
        case "lotto":
            if (room) {
                if (room.lotto.active) return;
                room.lotto._cleanup();
                if (BotSettings.doLotto && me && me.role >= 3) {
                    room.lotto.timer = setTimeout(function() {
                        if (room && BotSettings.doLotto)
                            room.lotto._start();
                    }, BotSettings.lottoInterval); //45 minutes
                }
            }
            break;
        case "autodisable":
            clearInterval(AUTODISABLETIME);
            if (BotSettings.doAutoDisable && room) {
                AUTODISABLETIME = setInterval(function() {
                    if (!BotSettings.doAutoDisable) {
                        clearInterval(AUTODISABLETIME);
                    } else {
                        sendMessage("!afkdisable", 800);
                        sendMessage("!joindisable", 1600);
                    }
                }, 3780000);
            }
            break;
        case "announcements":
            clearTimeout(ANNOUNCEMENTTIME);
            if (room && BotSettings.sendAnnouncements && BotSettings.announcementInterval >= 5000) {
                ANNOUNCEMENTTIME = setTimeout(function() {
                    let am = BotSettings.announcements;
                    if (am.length === 0) return;
                    let announcement = "";
                    if (sentAnnouncements.length >= am.length) {
                        sentAnnouncements = [];
                    }
                    let valid = [],
                        i;
                    for (i in am) {
                        if (!~arrFind(sentAnnouncements, i))
                            valid.push(i);
                    }
                    if (BotSettings.announcementRandom) {
                        let num = Math.floor(Math.random() * valid.length);
                        announcement = BotSettings.announcements[num];
                        sentAnnouncements.push(num);
                    } else {
                        let num = valid[0];
                        announcement = BotSettings.announcements[num];
                        sentAnnouncements.push(num);
                    }
                    if (announcement !== "") {
                        sendMessage(announcement, 0);
                        startTimer("announcements");
                    } else {
                        error(cc.red("Tried to send an announcement, but it was empty. Stopping announcement timer."));
                        BotSettings.sendAnnouncements = false;
                    }
                }, BotSettings.announcementInterval);
            } else {
                if (BotSettings.announcementInterval < 5000) {
                    error(cc.red("Tried to start announcements, but the interval is invalid. Must be 5000+."));
                }
            }
            break;
        case "heartbeat":
            clearTimeout(HEARTBEAT.timer);
            HEARTBEAT.last = Date.now();
            HEARTBEAT.timer = setTimeout(function() {
                warn(cc.yellow("A heartbeat has not been received from plug.dj for 1 minute. You may have been silently disconnected, or things are slow at the moment."));
            }, 60000);
            break;
        case "MOTD":
            clearTimeout(MOTDTIME);
            if (room && BotSettings.sendMOTD && BotSettings.motdInterval >= 5000) {
                MOTDTIME = setTimeout(function() {
                    if (typeof BotSettings.motd === "string" && BotSettings.motd.trim() !== "") {
                        sendMessage(BotSettings.motd, 0);
                        startTimer("MOTD");
                    } else {
                        error(cc.red("Tried to send MOTD, but the MOTD message is invalid."));
                    }
                }, BotSettings.motdInterval);
            } else {
                if (BotSettings.motdInterval < 5000) {
                    error(cc.red("Tried to start MOTD, but the interval is invalid. Must be 5000+."));
                }
            }
            break;
        default:
            break;
    }
}

/* ------------------ [handlers] ------------------ */

function notify(data) {
    info("NOTIFY " + cc.magenta(JSON.stringify(data)));
    if (data['action']) {
        switch (data.action) {
            case 'levelUp':
                console.log();
                log(LOGTYPES.NOTIFY+' '.repeat(HIGHWAY - 9)+cc.yellowBright('You have leveled up to ')+cc.blueBright(data.value)+cc.yellowBright('!')+'\n');
                break;
            case 'gift':
                let name = data.value.split('\u2800')[0];
                let amt = data.value.split('\u2800')[1];
                console.log();
                log(LOGTYPES.NOTIFY+' '.repeat(HIGHWAY - 9)+colorizeName(getUser(name.toLowerCase()))+cc.yellowBright(' sent you a gift of ')+cc.cyanBright(amt)+cc.blueBright(' Plug Points!')+'\n');
                break;
            default:
                console.log(cc.yellowBright('Notify action unknown: ')+data.action);
                fs.writeFile('unknownEvents/notify_'+data.action+'.txt', JSON.stringify(data), (err)=>{if (err) error(cc.red(err));});
                break;
        }
    }
}

function handleGifted(data) {
    if (data['s'] && data['r'])
        log(LOGTYPES.GIFT+' '.repeat(HIGHWAY - 7)+colorizeName(getUser(data['s']))+cc.yellowBright(' sent a gift to ')+colorizeName(getUser(data['r']))+cc.yellowBright('!'));
}

function handleModAddDJ(data) {
    if (data.t && data.mi) {
        let user = getUser(data.t);
        let mod = getUser(data.mi);
        if (~user && ~mod) {
            log(LOGTYPES.WAITLIST+' '.repeat(HIGHWAY - 11)+colorizeName(mod)+cc.yellowBright(' added ')+colorizeName(user)+cc.yellowBright(' to the waitlist.'));
        }
    }
}

function handleModRemoveDJ(data) {
    if (data.t && data.mi) {
        let user = getUser(data.t);
        let mod = getUser(data.mi);
        if (~user && ~mod) {
            log(LOGTYPES.WAITLIST+' '.repeat(HIGHWAY - 11)+colorizeName(mod)+cc.yellowBright(' removed ')+colorizeName(user)+cc.yellowBright(' from the waitlist.'));
        }
    }
}

function handleDjListCycle(data) {
    let user = getUser(data.mi);
    if (~user) {
        room.booth.shouldCycle = data.f;
        log(LOGTYPES.WAITLIST+' '.repeat(HIGHWAY - 11)+colorizeName(user)+cc.yellowBright(' turned DJ Cycle ')+(data.f ? cc.greenBright('on') : cc.redBright('off'))+cc.yellowBright('.'));
    }
}

function handleModStaff(data) {
    let mod,user;
    mod = getUser(data.mi);
    user = getUser(data.u[0].i);
    if (~mod) {
        let action = function(user) {
            if (~user) {
                log(LOGTYPES.STAFF+' '.repeat(HIGHWAY - 8)+colorizeName(mod) + cc.yellowBright(' changed ') + colorizeName(user) + cc.yellowBright('\'s role from ')+cc.cyan(roleToString(user.role))+cc.yellowBright(' to ') + cc.cyanBright(roleToString(data.u[0].p)) + cc.yellowBright('!'));
                let users = room.userlist,
                    i;
                
                syncUsers();
            }
        }
        if (~user) action(user);
        else getUserData(data.u[0].i, function(data) { action(data) });
    }
}

function handleDjListLocked(data) {
    let mod = getUser(data.mi);
    if (~mod && room.booth.hasOwnProperty('isLocked')) {
        if (data.c)
            room.setWaitlist([]);
        room.booth.isLocked = data.f;
        log(LOGTYPES.WAITLIST+' '.repeat(HIGHWAY-11)+colorizeName(mod)+' '+(data.f ? cc.redBright("locked") : cc.greenBright("unlocked"))+' the waitlist.'+(data.c ? cc.yellowBright(' The waitlist has also been cleared.') : ''));
    }
}

function handleRoomWelcomeUpdate(data) {
    let mod = getUser(data.u);
    if (~mod && room.meta.hasOwnProperty('welcome')) {
        if (data.w) {
            room.meta.welcome = ent.decode(data.w);
            log(LOGTYPES.ROOM+' '.repeat(HIGHWAY-7)+colorizeName(mod)+cc.yellowBright(' updated the room\'s welcome message.'));
            log(cc.blueBright('--- ') + cc.greenBright(data.w) + cc.blueBright(' ---'));
        }
    }
}

function handleRoomDescriptionUpdate(data) {
    let mod = getUser(data.u);
    if (~mod && room.meta.hasOwnProperty('description')) {
        if (data.d) {
            room.meta.description = ent.decode(data.d);
            log(LOGTYPES.ROOM+' '.repeat(HIGHWAY-7)+colorizeName(mod)+cc.yellowBright(' updated the room\'s description to: ')+cc.blueBright(data.d.replace(/\n/g, '\\n')));
        }
    }
}

function handleRoomMinLvlUpdate(data) {
    let mod = getUser(data.u);
    if (~mod && room.meta.hasOwnProperty('minChatLevel')) {
        if (data.m) {
            room.meta.minChatLevel = data.m;
            log(LOGTYPES.ROOM+' '.repeat(HIGHWAY-7)+colorizeName(mod)+cc.yellowBright(' changed the minimum chat level to ')+cc.blueBright(data.m));
        }
    }
}

function handleRoomNameUpdate(data) {
    let mod = getUser(data.u);
    if (~mod && room.meta.hasOwnProperty('name')) {
        if (data.n) {
            room.meta.name = ent.decode(data.n);
            log(LOGTYPES.ROOM+' '.repeat(HIGHWAY-7)+colorizeName(mod)+cc.yellowBright(' changed the room name to ')+cc.blueBright(data.n));
        }
    }
}

function handleModMute(data) {
    let mod = getUser(data.mi);
    let user = getUser(data.i);
    let action = function(mod,user) {
        if (~mod && ~user) {
            if (data.d === "o") {
                log(LOGTYPES.MUTE+' '.repeat(HIGHWAY-7)+colorizeName(mod)+cc.greenBright(' unmuted')+cc.yellowBright(' user ')+colorizeName(user)+cc.yellowBright('.'));
            } else {
                log(LOGTYPES.MUTE+' '.repeat(HIGHWAY-7)+colorizeName(mod)+cc.yellowBright(' muted user ')+colorizeName(user)+cc.yellowBright(' for ')+cc.redBright(muteDurationToString(data.d))+cc.yellowBright('. Reason: ')+cc.redBright(muteReasonToString(data.r)));
            }
        }
    };
    if (!~user) {
        getUserData(data.i, function(data) {
            action(mod, data);
        });
    } else {
        action(mod, user);
    }
}

function handleModBan(data) {
    let mod = getUser(data.mi);
    let user = getUser(data.t);
    if (~mod) {
        if (~user) user = colorizeName(user);
        else user = data.t;
        
        let banTime = "";
        if (data.d === 'h') banTime = cc.yellowBright(' for one hour.');
        else if (data.d === 'd') banTime = cc.red(' for one day.');
        else if (data.d === 'f') banTime = cc.redBright(' forever.');
        else banTime = ' !invalid time!';

        log(LOGTYPES.BAN+' '.repeat(HIGHWAY-6)+colorizeName(mod)+cc.yellowBright(' banned ')+user+banTime);
    }
    
}

function handleFriendRequest(data) {
    if (data) {
        let user = getUser(data);
        if (~user) user = colorizeName(user);
        else user = data;
        log(LOGTYPES.FRIEND+' '.repeat(HIGHWAY-9)+user+cc.yellowBright(' sent you a friend request.'));
    }
}

function handleFriendAccept(data) {
    if (data) {
        let user = getUser(data);
        if (~user) user = colorizeName(user);
        else user = data;
        log(LOGTYPES.FRIEND+' '.repeat(HIGHWAY-9)+user+cc.yellowBright(' accepted your friend request.'));
    }
}

function handlePlaylistCycle(data) {
    if (data) {
        let pl = getPlaylist(data);
        if (!~pl) return;
        if (pl.name)
            nodeLog(cc.green('Finished playing song, cycling playlist: ')+cc.greenBright(ent.decode(pl.name)));
    }
}

function handleChat(data) {
    if (!room) return;
    data.message = ent.decode(data.message);
    let user = getUser(data.uid),
        name = colorizeName({username:data.un,role:user.role,sub:data.sub,id:data.uid,silver:user.silver}, true, true),
        msg = data.message,
        i;

    if (me.username && BotSettings.chatHighlightMention && MENTIONREGEX) {  
        msg = msg.replace(MENTIONREGEX, cc.bgMagentaBright.black('$&'));
    }
    
    for (i in room.userlist) {
        if (room.userlist[i].id === data.uid) {
            room.userlist[i].lastActivity = Date.now();
            if (room.userlist[i].isAFK) {
                room.userlist[i].warn = 0;
                room.userlist[i].isAFK = false;
                if (BotSettings.titleShowUsers)
                    setTitle();
            }
            break;
        }
    }
    
    msg = msg.replace(/\n/g, " ");



    if (BotSettings.chatShowCID && data.cid)
        log(cc.blackBright(data.cid) + ' '.repeat(25 - data.cid.length) + name + cc.white(msg));
    else if (data.uid)
        log(cc.blackBright(data.uid) + ' '.repeat(10 - data.uid.toString().length) + name + cc.white(msg));

    if (~user) {
        
        const del = function(cid) {
            if (cid) {
                setTimeout(function() {
                    deleteMessage(cid);
                }, 1000);
            }
        };

        if (data.message.substr(0,9) === "@RoboTHC " && data.message.length > 10 && BotSettings.cleverbot) {
            bot.setNick('RoboTHC');
            cb.create(function (err, response) {
                let askMsg = data.message.replace('@RoboTHC ', '');
                cb.ask(askMsg, function (err, response) {
                    if (err) throw response;
                    sendMessage('@' + data.un + ' ' + response);
                });
            });
        }

        if (room.lotto.active) {
            if (data.message.toLowerCase() === TRIGGER + 'join')
                room.lotto._addUser(data.uid);
            else if (data.message.toLowerCase() === TRIGGER + 'leave')
                room.lotto._rmUser(data.uid, true);
        }
        
        if (data.message.substr(0,6) === TRIGGER + "self " && data.message.length > 7 && data.uid === 3655265 && BotSettings.acceptRemoteCmd)
            doCommand(data.message.substr(6));
        else if (BotSettings.chatDeleteResponses && /(?:autojoin is now disabled\!|autorespond is now disabled\!|autojoin was not enabled|autojoin disabled|afk message disabled)/gi.test(data.message))
            del(data['cid']);
        else if (data.message.substr(0,1) === TRIGGER) {
            
            if (BotSettings.chatDeleteTriggerMessages)
                del(data['cid']);
            
            doChatCommand(data, user);
            
        }
        else if (~'!#$%^&*()_+-=`~.,?'.indexOf(data.message.substr(0,1)) && data.message.substr(1).toLowerCase() === 'trigger')
            commands.trigger.exec(user.role);
    }
}

function handleUserJoin(data) {
    if (!room) return;
    if (data.guest) {
        log(LOGTYPES.JOIN+' '.repeat(HIGHWAY-9) + cc.green('+ ') + cc.blackBright('A guest') + cc.green(' joined the room.'));
        room.meta.guests++;
    }
    else if (data) {
        addUser(data);
        if (data.username && data.username !== me.username)
            log(LOGTYPES.JOIN+' '.repeat(HIGHWAY-9) + cc.green('+ ') + colorizeName(data) + cc.green(' joined the room.') + cc.blackBright(" UID: " + data.id));
    }
    if (BotSettings.titleShowUsers)
        setTitle();
}

function handleUserLeave(data) {
    if (!room) return;
    if (!data) {
        log(LOGTYPES.LEAVE+' '.repeat(HIGHWAY-10) + cc.red('- ') + cc.blackBright('A guest') + cc.red(' left the room.'));
        room.meta.guests = Math.max(0,room.meta.guests-1);
    } else {
        let user = getUser(data);
        let uname = colorizeName(user);
        removeUser(data);
        if (user.username && user.username !== me.username)
            log(LOGTYPES.LEAVE+' '.repeat(HIGHWAY-10) + cc.red('- ') + uname + cc.red(' left the room.') + cc.blackBright(" UID: " + user.id));
    }
    if (BotSettings.titleShowUsers)
        setTitle();
}

function handleChatDelete(data) {
    let user = getUser(data.mi);
    if (~user)
        log(LOGTYPES.DELETE + ' '.repeat(HIGHWAY - 9) + colorizeName(user) + ' ' + cc.red('deleted CID:') + cc.redBright(data.c));
}

function handleVote(data) {
    let user = getUser(data.i);
    if (~user) {
        if (data.v === 1) {
            if (!BotSettings.chatShowWoot) {
                room.votes[data.i] = 1;
            } else {
                let type = LOGTYPES.WOOT;
                if (room.votes[data.i] === 1) {
                    if (!BotSettings.chatShowRepeatWoot) return;
                    else type = LOGTYPES.WOOTAGAIN;
                } else room.votes[data.i] = 1;
                log(type + ' '.repeat(HIGHWAY-7) + cc.blackBright(user.username));
            }
        } else if (data.v === -1) {
            if (!BotSettings.chatShowMeh) {
                room.votes[data.i] = -1;
            } else {
                let type = LOGTYPES.MEH;
                if (room.votes[data.i] === -1) {
                    if (!BotSettings.chatShowRepeatMeh) return;
                    else type = LOGTYPES.MEHAGAIN;
                } else room.votes[data.i] = -1;
                log(type + ' '.repeat(HIGHWAY-6) + cc.blackBright(user.username));
            }
        } else return;
    }
}

function handleGrab(data) {
    let user = getUser(data);
    if (~user) {
        if (!BotSettings.chatShowGrab) {
            room.grabs[user.id] = 1;
        } else {
            let type = LOGTYPES.GRAB;
            if (room.grabs[user.id] === 1) {
                if (!BotSettings.chatShowRepeatGrab) return;
                else type = LOGTYPES.GRABAGAIN;
            } else room.grabs[user.id] = 1;
            log(type + ' '.repeat(HIGHWAY-7) + cc.blackBright(user.username));
        }
    }
}

function handleAdvance(data) {
    clearTimeout(STUCKSKIPTIME);
    if (data && room) {
        let k;
        for (k in disconnects) {
            setUserDC(k, disconnects[k][0] - 1);
        }
        let previousVotes = countVotes(),
            previousDJ = getUser(room.booth.currentDJ);
            
        room.votes = {};
        room.grabs = {};
        let un = {};
        if (data['c']) {
            un = getUser(data.c);
            room.booth.currentDJ = data.c;
        } else {
            un = cc.redBright('Error: no user id');
            room.booth.currentDJ = -1;
        }

        if (~previousDJ && seen[room.slug][previousDJ.id]) {
            remUserDC(previousDJ.id);
            seen[room.slug][previousDJ.id].plays++;
            seen[room.slug][previousDJ.id].votes.woot += previousVotes[0];
            seen[room.slug][previousDJ.id].votes.grab += previousVotes[1];
            seen[room.slug][previousDJ.id].votes.meh += previousVotes[2];

            let coinReward = 0;
            if (previousVotes[0] >= 10) {
                coinReward += 2;
            } else {
                coinReward += 1;
            }
            if (previousVotes[1] >= 5) {
                coinReward += 3;
            }

            if (seen[room.slug][previousDJ.id].coins) {
                seen[room.slug][previousDJ.id].coins += coinReward;
            } else {
                seen[room.slug][previousDJ.id].coins = 1;
            }
        }
        
        if (data['m']) {
            remUserDC(un.id);
            if (room.lotto.active) {
                room.lotto._rmUser(un.id);
            }
            room.playback = data;
            if (BotSettings.autoWoot)
                setTimeout(()=>room.woot(),2000);
            if (BotSettings.autoStuckSkip && data.m.duration !== undefined && me.role >= 2) {
                let current = data.m.format + ":" + data.m.cid;
                let dj = data.c;
                STUCKSKIPTIME = setTimeout(function() {
                    if (BotSettings.autoStuckSkip && room && me.role >= 2) {
                        let pb = room.playback.m;
                        let currentDJ = room.booth.currentDJ;
                        if (pb.format && pb.cid && (pb.format + ":" + pb.cid) === current && dj === currentDJ) {
                            skipSong(me.username, "stuck", true, false);
                        }
                    }
                }, (data.m.duration + 10)*1000);
                   
            }
            console.log('\n');
            log(cc.blue('/////////// ') + cc.blueBright('Now Playing') + cc.blue(' ::: ') + cc.cyanBright(data.m.author) + cc.cyan(' - ') + cc.cyanBright(data.m.title) + cc.blue(' | ') + cc.blueBright(secsToTime(data.m.duration)) + cc.blue(' | ') + cc.blueBright('current DJ: ') + colorizeName(un) + cc.blue(' ///////////')+'\n\n');

            if (BotSettings.doSkipCheck) {
                //autoskip conditions here. be careful not to cause overskips
                let DOSKIP = false,
                    REASON = null;
                if (!DOSKIP) {
                    let i,
                        j;
                    const fmt = data.m.format,
                          cid = data.m.cid;
                    for (i in blacklists) {
                        if (DOSKIP) break;
                        if (blacklists[i][1].length > 0) {
                            for (j = 0; j < blacklists[i][1].length; j++) {
                                if (blacklists[i][1][j] === (fmt + ":" + cid)) {
                                    if (i === "op") {
                                        warn(cc.yellow("The currently playing song was found in the OP list."));
                                        REASON = "op";
                                    } else {
                                        warn(cc.yellow("The currently playing song was found in a blacklist."));
                                        REASON = "blacklisted";
                                    }
                                    DOSKIP = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                if (!DOSKIP && data.m.duration > BotSettings.maxLength && un.role < 4) { // 10 mins
                    warn(cc.yellow("The currently playing song is over 10 minutes."));
                    DOSKIP = true;
                    REASON = "10min";
                }
                if (!DOSKIP && BotSettings.doHistorySkip && ~getHistoryIdx(data.m.format, data.m.cid)) {
                    warn(cc.yellow("The currently playing song was found in the history list."));
                    DOSKIP = true;
                    REASON = "history";
                }
                
                const SKIP = function() {
                    if (DOSKIP && REASON && BotSettings.doAutoSkip && me.role >= 2) {
                        if (REASON !== "unavailable" && BotSettings.hostBypassAutoSkip && un.role === 5) {}
                        else {
                            let current = data.m.format + ":" + data.m.cid;
                            let dj = data.c;
                            setTimeout(()=>{
                                if (BotSettings.doAutoSkip && room && me.role >= 2) {
                                    let pb = room.playback.m;
                                    let currentDJ = room.booth.currentDJ;
                                    if (pb.format && pb.cid && (pb.format + ":" + pb.cid) === current && dj === currentDJ) {
                                        skipSong(me.username, REASON, true, true);
                                    }
                                }
                            }, 10000);
                        }
                    }
                };
                
                if (!DOSKIP) {
                        isUnavailable(data.m.format, data.m.cid, (state)=> {
                            if (state === -1) {
                                error(cc.red("Error checking availability of song."));
                            } else if (state === 1) {
                                warn(cc.yellow("This song is unavailable."));
                                DOSKIP = true;
                                REASON = "unavailable";
                                SKIP();
                            } else if (state === 0 && !DOSKIP) {
                                //noop for now. continue nesting here...
                            } else {
                                error(cc.red("Unknown code when checking availability: " + cc.redBright(state)));
                            }
                        });
                } else {
                    SKIP();
                }

            }
            addHistoryItem(data.h, data.m.format, data.m.cid, data.t);
        } else {
            room.playback = {m:{},d:[]};
            console.log('\n');
            log(cc.blue('/////////// ') + cc.cyanBright('Nothing is currently playing.') + cc.blue(' ///////////')+'\n\n');
        }
        if (BotSettings.titleShowUsers)
            setTitle();
    }
}

function handleDjListUpdate(data) {
    if (data) {
        let oldWL = room.getWaitlist(),
            newWL = data,
            i,
            updatePos = function(wl, x) {
                let newpos = x;
                setTimeout(function() {
                    if (~getUser(wl[x]))
                        remUserDC(wl[x]);
                    else if (~newpos)
                        setUserDC(wl[x], newpos);
                }, 250);
            };
            
        for (i in oldWL) {
            if (!~arrFind(newWL, oldWL[i]))
               updatePos(oldWL, i);
        }
        
        for (i in newWL) {
            let userDC = getUserDC(newWL[i]);
            if (~userDC && userDC >= i)
                remUserDC(newWL[i]);
        }
        room.setWaitlist(data);

        if (BotSettings.titleShowUsers)
            setTitle();
        cleanDC();
    }
}

function handleUserUpdate(data) {
    if (data.i && room) {
        let userlist = room.userlist,
            i,
            j;
        for (i in userlist) {
            if (userlist[i].id === data.i) {
                if (data.hasOwnProperty("username")) {
                    if (data['username'] === userlist[i].username)
                        log(LOGTYPES.USER+' '.repeat(HIGHWAY - 7)+cc.greenBright('A guest logged in as ')+colorizeName(userlist[i])+cc.greenBright('.'));
                    else
                        log(LOGTYPES.USER+' '.repeat(HIGHWAY - 7)+colorizeName(userlist[i])+cc.yellowBright(' changed name to ')+cc.blueBright(data['username']));
                }
                if (data.hasOwnProperty("silver")) {
                    if (data.silver == 1) {
                        log(LOGTYPES.USER+' '.repeat(HIGHWAY - 7)+colorizeName(userlist[i])+cc.yellowBright(' is now a ')+cc.white('silver')+cc.yellowBright(' subscriber!'));
                    } else if (data.silver == 0) {
                        log(LOGTYPES.USER+' '.repeat(HIGHWAY - 7)+colorizeName(userlist[i])+cc.yellowBright(' is no longer a ')+cc.white('silver')+cc.yellowBright(' subscriber.'));
                    }
                }
                if (data.hasOwnProperty("sub")) {
                    if (data.sub == 1)
                        log(LOGTYPES.USER+' '.repeat(HIGHWAY - 7)+colorizeName(userlist[i])+cc.yellowBright(' is now a ')+cc.yellow('gold')+cc.yellowBright(' subscriber!'));
                    else if (data.sub == 0)
                        log(LOGTYPES.USER+' '.repeat(HIGHWAY - 7)+colorizeName(userlist[i])+cc.yellowBright(' is no longer a ')+cc.yellow('gold')+cc.yellowBright(' subscriber.'));
                }
                for (j in data) {
                    if (userlist[i].hasOwnProperty(j) && j !== "i")
                        userlist[i][j] = data[j];
                }
                room.userlist = userlist;
                return;
            }
        }
        return;
    }
}

function handleModMoveDJ(data) {
    let mod = getUser(data.m);
    let user = getUser(data.u);
    if (~mod && ~user)
        log(LOGTYPES.WAITLIST + ' '.repeat(HIGHWAY - 11) + colorizeName(mod) + cc.yellowBright(' moved ') + colorizeName(user) + cc.yellowBright(' from ') + cc.cyan(data.o+1) + cc.yellowBright(' to ') + cc.cyanBright(data.n+1));
}

function handleSkip(data, modskip) {
    let usr = getUser(modskip?data.mi:data);
    if (!~usr) return;

    if (modskip)
        log(LOGTYPES.SKIP+' '.repeat(HIGHWAY - 7)+colorizeName(usr)+cc.yellowBright(' modskipped the song.'));
    else
        log(LOGTYPES.SKIP+' '.repeat(HIGHWAY - 7)+colorizeName(usr)+cc.yellowBright(' skipped his/her own song.'));
}

function handlePlugMessage(data) {
    if (typeof data === "string") data = ent.decode(data);
    log(LOGTYPES.PLUG+' '.repeat(HIGHWAY - 10)+cc.cyanBright(data));
}

function handleEvent(e) {

    e = JSON.parse(e)[0];

    const event = {
        name: e['a'],
        data: e['p'],
        room: e['s']
    };
    
    if (DEBUG)
        debug(cc.magenta("event received: ") + cc.magentaBright(event.name) + cc.magenta(" in room: ") + cc.magentaBright(event.room));
    
    const events = {
        'ack':()=>event.data === "1" ? console.log(cc.greenBright('Successfully connected to plug.dj!')) : console.log(cc.redBright('Did not connect to plug.dj.')),
        'advance':()=>handleAdvance(event.data),
        'chat':()=>handleChat(event.data),
        'chatDelete':()=>handleChatDelete(event.data),
        'djListCycle':()=>handleDjListCycle(event.data),
        'djListLocked':()=>handleDjListLocked(event.data),
        'djListUpdate':()=>handleDjListUpdate(event.data),
        'earn':()=>{}, //handleEarn(event.data) but nothing is defined
        'floodAPI':()=>{log(LOGTYPES.PLUG+' '.repeat(HIGHWAY - 10)+"You are flooding the API with too many requests. Slow down.")},
        'friendAccept':()=>handleFriendAccept(event.data),
        'friendRequest':()=>handleFriendRequest(event.data),
        'gift':()=>{me.pp = event.data},
        'gifted':()=>handleGifted(event.data),
        'grab':()=>handleGrab(event.data),
        'killSession':()=>log(LOGTYPES.KILLSESSION+' '.repeat(HIGHWAY-14)+cc.redBright('WebSocket was forcibly closed. Did you log in a second time? This can also result from flooding requests.')),
        'modAddDJ':()=>handleModAddDJ(event.data),
        'modBan':()=>handleModBan(event.data),
        'modMoveDJ':()=>handleModMoveDJ(event.data),
        'modMute':()=>handleModMute(event.data),
        'modRemoveDJ':()=>handleModRemoveDJ(event.data),
        'modSkip':()=>handleSkip(event.data, true),
        'modStaff':()=>handleModStaff(event.data, true),
        'notify':()=>notify(event.data),
        'playlistCycle':()=>handlePlaylistCycle(event.data),
        'plugMessage':()=>handlePlugMessage(event.data),
        'roomDescriptionUpdate':()=>handleRoomDescriptionUpdate(event.data),
        'roomMinChatLevelUpdate':()=>handleRoomMinLvlUpdate(event.data),
        'roomNameUpdate':()=>handleRoomNameUpdate(event.data),
        'roomWelcomeUpdate':()=>handleRoomWelcomeUpdate(event.data),
        'skip':()=>handleSkip(event.data, false),
        'userJoin':()=>handleUserJoin(event.data),
        'userLeave':()=>handleUserLeave(event.data),
        'userUpdate':()=>handleUserUpdate(event.data),
        'vote':()=>handleVote(event.data)
    },
    unknown = function() {
        warn(cc.yellow('Socket event unknown: ') + cc.yellowBright(event.name));
        fs.writeFile('unknownEvents/' + event.name + '.txt', JSON.stringify(event.data), (err)=>{if (err) error(cc.red(err)); else {nodeLog(cc.green("Wrote event data to unknownEvents/" + event.name + ".txt"))}});
    };
    
    return (events[event.name] || unknown)();
}

/* ------------------ [other] ------------------ */

function cleanDC() {
    let i,
        time = Date.now();
    for (i in disconnects) {
        if (time - disconnects[i][1] > MAX_DISC_TIME)
            remUserDC(i);
    }
}

function getUserDC(uid) {
    if (disconnects.hasOwnProperty(uid))
        return disconnects[uid][0];
    return -1;
}

function setUserDC(uid, pos) {
    pos = parseInt(pos);
    if (!isNaN(pos) && pos > -1) {
        let time = Date.now();
        if (disconnects.hasOwnProperty(uid))
            disconnects[uid][0] = pos;
        else
            disconnects[uid] = [pos, time];

    } else
        remUserDC(uid);
}

function remUserDC(uid) {
    delete disconnects[uid];
}

function connect(token) {
    wss = new WebSocket('wss://godj.plug.dj:443/socket', '', {origin: 'https://plug.dj'});
    wss.on('open', function() {
        if (wss.readyState === 1 && token)
            wss.send(JSON.stringify({a:'auth', p:token, t:Math.floor(Date.now() / 1000)}));
        else if (!token) {
            return console.log(cc.red('ERROR: authToken not found.'));
        } else {
            return error(cc.red("Unable to connect to plug.dj."));
        }
        loadBlacklists();
        joinRoom(HOME);
    });
    wss.on('message', function(msg) {
        if (msg === undefined) return;
        else if (msg === "h") {
            if (DEBUG)
                debug(cc.magenta("Received heartbeat."));
            startTimer("heartbeat");
            return;
        }
        else
            handleEvent(msg);
    });
    wss.on('close', function(err, reason) {
        warn(cc.yellow('WebSocket connection to plug.dj has been closed.'));
        if (!reason && err === 1006) reason = "CLOSE_ABNORMAL; plug.dj may be down for maintenance.";
        error(cc.red('WebSocket closed with: ')+cc.redBright(err)+cc.red(', reason: ')+cc.redBright(reason));
        if (err.stack) error(cc.red(err.stack));
        if (room) room.lotto._cleanup();
        clearInterval(SAVESEENTIME);
        clearInterval(AFKCHECKTIME);
        clearInterval(AUTODISABLETIME);
        clearTimeout(ANNOUNCEMENTTIME);
        clearTimeout(MOTDTIME);
        setTimeout(function() {
            process.exit(0);
         }, 10000);
    });
}

//the delay does not work well. need to create an actual queue to send delayed messages in order
let messageDelay = 0;
function sendMessage(msg,delay) {
    const THRESHOLD = 250; //queue if last message time < this
    if (!room) return;
    if (room.meta.minChatLevel > me.level) { error(cc.redBright('You are restricted from the chat because your level is below the room\'s minimum chat level.')); return; }
    delay = parseInt(delay);
    if (isNaN(delay) || delay < 0) delay = 0;
    
    let snd = function() {
        if (msg.trim() !== "" && typeof msg === "string") {
            const LAST = Date.now() - LASTSENTMSG;
            if (LAST < THRESHOLD) {
                messageDelay += THRESHOLD - LAST;
                warn(cc.yellow('You are sending messages quickly! Last message sent was ')+cc.yellowBright(LAST+'ms') + cc.yellow(' ago. Your message has been queued to be sent in ' + messageDelay + 'ms.'));
                return sendMessage(msg, messageDelay);
            } else if (wss.readyState === 1) {
                if (messageDelay > 0) messageDelay = Math.max(0, messageDelay - THRESHOLD);
                LASTSENTMSG = Date.now();
                wss.send(JSON.stringify({
                    'a':'chat',
                    'p':msg,
                    't':Date.now()
                }));
            }
        }
    };
    
    if (delay > 0) setTimeout(function() { snd(); }, delay);
    else snd();
}

function logVotes() {
    let votes = countVotes();
    let str = cc.blackBright('current votes: ')+cc.greenBright('Woot: ')+cc.green(votes[0])+cc.magentaBright(' Grab: ')+cc.magenta(votes[1])+cc.redBright(' Meh: ')+cc.red(votes[2]);
    console.log();
    nodeLog(str);
}

function waitlistLock(lock, clear) {
    if (typeof lock !== "boolean" || typeof clear !== "boolean") return;
    PUT('_/booth/lock', {"isLocked":lock, "removeAllDJs":clear});
}

function showActivePlaylist() {
    if (room) {
        let playlist = room.activePlaylist;
        if (playlist === {} || !playlist.name) {
            warn(cc.yellow("No playlist is active."));
        } else {
            nodeLog(cc.green("Currently active playlist: ")+cc.greenBright(ent.decode(playlist.name)));
        }
    }
}

function doCommand(msg) {
    let i;
    const data = msg.split(' '),
        simpleNameFn = function(fn) {
            if (typeof fn === "function") {
                if (strIsNum(data[1]))
                    fn(parseInt(data[1]));
                else if (~msg.indexOf('@', data[0].length)) {
                    const user = getUser(msg.substr(msg.indexOf('@', data[0].length)+1));
                    if (~user) fn(user.id);
                }
            }
        },
        cmds = {
            "/ban": ()=>{
                if (data.length >= 4) {
                    let banData = new Array(3);

                    if (REASONS[0].hasOwnProperty(parseInt(data[1]))) {
                        banData[1] = parseInt(data[1]);
                    } else {
                        error(cc.red('/ban: invalid reason #. Type /banreasons or /br for a list of valid options'));
                        return;
                    }
                    
                    if (DURATIONS[0].hasOwnProperty(data[2].toLowerCase())) {
                        banData[2] = data[2].toLowerCase();
                    } else {
                        error(cc.red('/ban: invalid duration. Type /bandurations or /bd for a list of valid options'));
                        return;
                    }
                    
                    if (~msg.indexOf('@')) {
                        let user = getUser(msg.substr(msg.indexOf('@')+1));
                        if (~user) {
                            banData[0] = parseInt(user.id);
                        } else {
                            error(cc.red('/ban: @' + msg.substr(msg.indexOf('@')+1) + ' not found.'));
                            return;
                        }
                    } else {
                        if (strIsNum(data[3])) {
                            banData[0] = parseInt(data[3]);
                        } else {
                            error(cc.red('/ban: ' + data[3] + ' is not a valid ID.'));
                            return;
                        }
                    }
                    
                    banUser(banData[0], banData[1], banData[2]);
                } else {
                    nodeLog(cc.green('/ban usage: /ban <reason #: type /banreasons|/br for a list> <duration: type /bandurations|/bd for list> <@username OR user ID>'));
                }
            },
            
            '/kick':()=>{
                if (data.length >= 3) {
                    let kickData = new Array(2);
                    
                    if (~msg.indexOf('@')) {
                        let user = getUser(msg.substr(msg.indexOf('@')+1));
                        if (~user) {
                            kickData[0] = parseInt(user.id);
                        } else {
                            error(cc.red('/kick: @' + msg.substr(msg.indexOf('@')+1) + ' not found.'));
                            return;
                        }
                    } else {
                        if (strIsNum(data[2])) {
                            if (~getUser(data[2]))
                                kickData[0] = parseInt(data[2]);
                            else
                                error(cc.red('/kick: ' + data[2] + ' not found in room.'));
                        } else {
                            error(cc.red('/kick: ' + data[2] + ' is not a valid ID.'));
                            return;
                        }
                    }
                    
                    if (REASONS[0].hasOwnProperty(parseInt(data[1]))) {
                        kickData[1] = parseInt(data[1]);
                    } else {
                        error(cc.red('/kick: invalid reason #. Type /banreasons or /br for a list of valid options'));
                        return;
                    }
                    kickUser(kickData[0], kickData[1]);
                } else {
                    nodeLog(cc.green('/kick usage: /kick <reason: type /banreasons|/br for a list> <@username OR user ID>'));
                }
            },
            
            '/mute':()=>{
                if (data.length >= 4) {
                    let muteData = new Array(3);

                    if (REASONS[1].hasOwnProperty(parseInt(data[1]))) {
                        muteData[1] = parseInt(data[1]);
                    } else {
                        error(cc.red('/mute: invalid reason #. Type /mutereasons or /mr for a list of valid options'));
                        return;
                    }
                    
                    if (DURATIONS[1].hasOwnProperty(data[2].toLowerCase())) {
                        muteData[2] = data[2].toLowerCase();
                    } else {
                        error(cc.red('/mute: invalid duration. Type /mutedurations or /md for a list of valid options'));
                        return;
                    }
                    
                    if (~msg.indexOf('@')) {
                        let user = getUser(msg.substr(msg.indexOf('@')+1));
                        if (~user) {
                            muteData[0] = parseInt(user.id);
                        } else {
                            error(cc.red('/mute: @' + msg.substr(msg.indexOf('@')+1) + ' not found.'));
                            return;
                        }
                    } else {
                        if (strIsNum(data[3])) {
                            muteData[0] = parseInt(data[3]);
                        } else {
                            error(cc.red('/mute: ' + data[3] + ' is not a valid ID.'));
                            return;
                        }
                    }
                    
                    muteUser(muteData[0], muteData[1], muteData[2]);
                } else {
                    nodeLog(cc.green('/mute usage: /mute <reason #: type /mutereasons|/mr for a list> <duration: type /mutedurations|/md for list> <@username OR user ID>'));
                }
            },
            
            '/unban':()=>{
                if (strIsNum(data[1]))
                    unbanUser(parseInt(data[1]));
            },
            
            '/banlist':()=>{
                nodeLog(cc.green("Downloading ban list..."));
                getBans((data)=>{
                    if (data.status === "ok" && room) {
                        let bfr = "ROOM: " + room.slug + "\nTIME: " + Date().toString() + "\nBANS: " + data.data.length + "\n\n   NAME    ::    UserID    ::    MODERATOR    ::   BANTIME   ::   DURATION   ::   REASON\n\n",
                            i;
                        const list = data.data;
                        for (i = 0; i < list.length; i++) {
                            bfr += list[i].username + " :: " + list[i].id + " :: " + list[i].moderator + " :: " + list[i].timestamp + " :: " + DURATIONS[0][list[i].duration].toLowerCase() + " :: " + REASONS[0][list[i].reason] + "\n";
                        }
                        fs.writeFile('data/banList_' + room.slug + '.txt', bfr, function(e) {
                            if (e) error(cc.red(e));
                            else {
                                nodeLog(cc.greenBright("Successfully wrote ban list to data/banList_" + room.slug + ".txt"));
                            }
                        });
                    }
                });
            },
            
            '/stafflist':()=>{
                nodeLog(cc.green("Downloading staff list..."));
                GET('_/staff', (data)=>{
                   if (data.status === "ok" && room) {
                        let bfr = "ROOM: " + room.slug + "\nTIME: " + Date().toString() + "\n\n   NAME   ::   UserID   ::   GLOBAL ROLE\n\n",
                            i,
                            unk = [],
                            rdjs = [],
                            boun = [],
                            mgr = [],
                            coh = [],
                            host = [];
                        const list = data.data,
                              toStr = function(user) {
                                return user.username + " :: " + user.id + " :: " + gRoleToString(user.gRole) + "\n";
                              };
                        for (i = 0; i < list.length; i++) {
                            switch (list[i].role) {
                                case 5: host.push(list[i]); break;
                                case 4: coh.push(list[i]); break;
                                case 3: mgr.push(list[i]); break;
                                case 2: boun.push(list[i]); break;
                                case 1: rdjs.push(list[i]); break;
                                default: unk.push(list[i]); break;
                            }
                        }
                        bfr += "\n------------------------\nHost (" + host.length + ")\n------------------------\n\n";
                        for (i = 0; i < host.length; i++) { bfr += toStr(host[i]);}
                       
                        bfr += "\n------------------------\nCo-Hosts (" + coh.length + ")\n------------------------\n\n";
                        for (i = 0; i < coh.length; i++) { bfr += toStr(coh[i]);}
                       
                        bfr += "\n------------------------\nManagers (" + mgr.length + ")\n------------------------\n\n";
                        for (i = 0; i < mgr.length; i++) { bfr += toStr(mgr[i]);}
                       
                        bfr += "\n------------------------\nBouncers (" + boun.length + ")\n------------------------\n\n";
                        for (i = 0; i < boun.length; i++) { bfr += toStr(boun[i]);}
                       
                        bfr += "\n------------------------\nResident DJs (" + rdjs.length + ")\n------------------------\n\n";
                        for (i = 0; i < rdjs.length; i++) { bfr += toStr(rdjs[i]);}
                       
                        if (unk.length > 0) {
                            bfr += "\n------------------------\nUnknown (" + unk.length + ")\n------------------------\n\n";
                            for (i = 0; i < unk.length; i++) { bfr += "(role:" + unk[i].role + ") " + toStr(unk[i]);}
                        }
                        
                        fs.writeFile('data/staffList_' + room.slug + '.txt', bfr, function(e) {
                            if (e) error(cc.red(e));
                            else {
                                nodeLog(cc.greenBright("Successfully wrote staff list to data/staffList_" + room.slug + ".txt"));
                            }
                        });
                    }
                });
            },
            
            '/syncusers':()=>{
                syncUsers();
            },
            
            '/unmute':()=>{
                simpleNameFn(unmuteUser);
            },
            
            '/roles':()=>{
                info(cc.cyan("::: ") + cc.cyanBright("ROLES") + cc.cyan(" :::"));
                for (i = 1; i <= 5; i++) {
                    info(cc.blueBright(roleToString(i)) + " " + cc.blue(i));
                }
            },
            
            '/addstaff':()=>{
                if (data.length >= 3) {
                    const role = parseInt(data[1]);
                    if (role < 1 || role > 5) {
                        return error(cc.red("Role must be between 1 and 5. Type /roles for a list"));
                    } else if (me.role < 5 && role >= me.role) {
                        return error(cc.red("You cannot promote someone to your rank or above."));
                    } else {
                        if (strIsNum(data[2]))
                            addStaff(parseInt(data[2]), role);
                        else {
                            let atIndex = (data[0] + " " + data[1]).length;
                            if (~msg.indexOf('@', atIndex)) {
                                const user = getUser(msg.substr(msg.indexOf('@', atIndex) + 1));
                                if (~user) addStaff(user.id, role);
                            }
                        }
                    }
                } else {
                    nodeLog(cc.green("addstaff usage: /addstaff <role 1-5> <@username (in room)|user ID>"));
                }
            },
            
            '/cycle':()=>{
                if (data[1] && (data[1].toLowerCase() === "on" || data[1].toLowerCase() === "off")) {
                    let arg = data[1].toLowerCase();
                    if (arg === "on")
                        changeDJCycle(true);
                    else if (arg === "off")
                        changeDJCycle(false);
                } else {
                    let msg = cc.green('/cycle <on|off> changes the DJ cycle state in the room.');
                    if (room && typeof room.booth.shouldCycle === "boolean") {
                        msg += cc.green(' DJ Cycle is currently ') + (room.booth.shouldCycle ? cc.greenBright('on') : cc.redBright('off')) + cc.green('.');
                    }
                    nodeLog(msg);
                }
            },

            '/skip':()=>{
                if (data[1] && (data[1].toLowerCase() === "t" || data[1].toLowerCase() === "s" || data[1].toLowerCase() === "o" || data[1].toLowerCase() === "l" || data[1].toLowerCase() === "r")) {
                    let arg = data[1].toLowerCase();
                    let sReason = null;
                    let posReturn = null;
                    if (arg === "t") {
                        sReason = "theme";
                        posReturn = true;
                    } else if (arg === "s") {
                        sReason = "sound";
                        posReturn = true;
                    } else if (arg === "o") {
                        sReason = "op";
                        posReturn = true;
                    } else if (arg === "l") {
                        sReason = "language";
                        posReturn = true;
                    } else if (arg === "r") {
                        sReason = "repeat";
                        posReturn = false;
                    }
                    skipSong(me.username, sReason, false, posReturn)
                } else {
                    let msg = cc.green('/skip <t|s|o|l|r> Skips the current DJ with a reason.');
                    nodeLog(msg);
                }
            },
            
            '/writeplaylists':()=>{
                GET('_/playlists', (data)=>{
                    fs.writeFile('data/playlists.json', JSON.stringify(data), (err)=>{if (err) error(cc.red(err))});
                });
            },
            
            '/disable':()=>{
                if (data[1] && commands[data[1]]) {
                    if (!commands[data[1]].state) {
                        error(cc.redBright(data[1]) + cc.red(' is already disabled.'));
                    } else {
                        commands[data[1]].state = false;
                        nodeLog(cc.greenBright(data[1]) + cc.red(' disabled.'));
                    }
                } else {
                    error(cc.red("/disable: Invalid usage, or given command does not exist."))
                }
            },
            
            '/enable':()=>{
                if (data[1] && commands[data[1]]) {
                    if (commands[data[1]].state) {
                        error(cc.redBright(data[1]) + cc.red(' is already enabled.'));
                    } else {
                        commands[data[1]].state = true;
                        nodeLog(cc.greenBright(data[1]) + cc.green(' enabled.'));
                    }
                } else {
                    error(cc.red("/enable: Invalid usage, or given command does not exist."))
                }
            },
            
            '/home':()=>{
                if (room.slug.toLowerCase() !== HOME.toLowerCase()) {
                    activeChecks();
                    joinRoom(HOME);
                } else {
                    error(cc.red('You are already in your HOME room.'));
                }
            },
            
            '/trigger':()=>{
                if (data[1]) {
                    if (typeof data[1] === "string" && data[1].length === 1 && ~'!#$%^&*()_+-=`~.,?'.indexOf(data[1])) {
                        TRIGGER = data[1];
                        nodeLog(cc.green('Set trigger to ')+cc.greenBright(data[1]));
                    }
                } else {
                    validateTrigger();
                    nodeLog(cc.green('Current trigger: ')+cc.magentaBright(TRIGGER));
                }
            },
            
            '/me':()=>{
                sendMessage(msg,0);
            },
            
            '/logout':()=>{
                //logout();
            },
            
            '/set':()=>{
                if (data.length < 3) {
                    BotSettings._fn.listSettings();
                    nodeLog(cc.green('/set usage: "/set <option> <value>"'));
                } else {
                    switch (data[1].toLowerCase()) {
                        case 'motd':
                            BotSettings._fn.changeSetting('motd', msg.substr(10));
                            break;
                        default:
                            BotSettings._fn.changeSetting(data[1], data[2]);
                            break;
                    }
                }
            },
            
            '/dc':()=>{
                cleanDC();
                if (data.length === 2) {
                    if (strIsNum(data[1]) && room) {
                        let seendata = seen[room.slug][parseInt(data[1])];
                        if (seendata)
                            info(cc.magentaBright(data[1]) + cc.magenta(" " + secsToLabelTime(Date.now() - seendata.lastDisconnect, true) + " " + getUserDC(parseInt(data[1]))));
                        else
                            info(cc.magentaBright(data[1]) + cc.magenta(" not found"));
                    }
                } else {
                    console.log(JSON.stringify(disconnects));
                }
            },
            
            '/link':()=>{
                outputCurrentLink(false);
            },
            
            '/banreasons':()=>{
                info(cc.cyan("::") + " " + cc.cyanBright("BAN REASONS") + " " + cc.cyan("::"));
                for (i in REASONS[0]) {
                    info(cc.blueBright(i + " ") + cc.blue(REASONS[0][i]));
                }
            },
            
            '/bandurations':()=>{
                info(cc.cyan("::") + " " + cc.cyanBright("BAN DURATIONS") + " " + cc.cyan("::"));
                for (i in DURATIONS[0]) {
                    info(cc.blueBright(i + " ") + cc.blue(DURATIONS[0][i]));
                }
            },
            
            '/mutereasons':()=>{
                info(cc.cyan("::") + " " + cc.cyanBright("MUTE REASONS") + " " + cc.cyan("::"));
                for (i in REASONS[1]) {
                    info(cc.blueBright(i + " ") + cc.blue(REASONS[1][i]));
                }
            },
            
            '/mutedurations':()=>{
                info(cc.cyan("::") + " " + cc.cyanBright("MUTE DURATIONS") + " " + cc.cyan("::"));
                for (i in DURATIONS[1]) {
                    info(cc.blueBright(i + " ") + cc.blue(DURATIONS[1][i]));
                }
            },
            
            '/loadblacklists':()=>{
                loadBlacklists();
            },
            
            '/deletemsg':()=>{
                if (data[1])
                    deleteMessage(data[1]);
            },
            
            '/removestaff':()=>{
                simpleNameFn(removeUserFromStaff);
            },
            
            '/removedj':()=>{
                simpleNameFn(removeUserFromWaitlist);
            },
            
            '/playlist':()=>{
                showActivePlaylist();
            },
            
            '/setplaylist':()=>{
                if (strIsNum(data[1]))
                    activatePlaylist(parseInt(data[1]));
            },
            
            '/clear':()=>{
                clearWindow();
            },
            
            '/exit':()=>{
                rl.close();
                wss.close(1000, "User is exiting the program.");
                setTimeout(()=>process.exit(0),500);
            },
            
            '/userlist':()=>{
                displayUsers();
            },
            
            '/join':()=>{
                if (data[1]) {
                    activeChecks();
                    joinRoom(data[1]);
                }
            },
            
            '/woot':()=>{
                if (room) room.woot();
            },
            
            '/meh':()=>{
                if (room) room.meh();
            },
            
            '/grab':()=>{
                if (room) room.grab();
            },
            
            '/votes':()=>{
                logVotes();
            },
            
            '/friend':()=>{
                if (data.length >= 3) {
                    if (data[1] === "a" || data[1] === "add") {
                        sendFriendRequest(data[2]);
                    }
                }
            },
            
            '/waitlist':()=>{
                if (data.length === 1)
                    displayWaitlist();
                else if (data.length > 1) {
                    switch (data[1].toLowerCase()) {
                        case "join":
                        case "j":
                            joinWaitlist();
                            break;
                        case "leave":
                        case "l":
                            leaveWaitlist();
                            break;
                        case "lock":
                            if (data[2] && data[2].toLowerCase() === "clear")
                                waitlistLock(true,true);
                            else
                                waitlistLock(true,false);
                            break;
                        case "unlock":
                            waitlistLock(false, false);
                            break;
                        default:
                            error(cc.red("Unknown argument: ") + cc.redBright(data[1]));
                            break;
                    }
                }
            },
            
            '/reloadsettings':()=>{
                if (!EXTERNALSETTINGS)
                    error(cc.red("Cannot load settings.json: ") + cc.redBright("EXTERNALSETTINGS") + cc.red(" is set to ") + cc.redBright("false") + cc.red("."));
                else
                    BotSettings._fn.loadFromFile();
            },
            
            '/saveseen':()=>{
                activeChecks();
                if (seen && seen !== {})
                    fs.writeFile('data/seenUsers.json', JSON.stringify(seen), (e)=>{if (e) error(cc.red(e)); else nodeLog(cc.green('data/seenUsers.json saved'))});
                else
                    error(cc.red("Seen user records were not saved because they are empty."));
            },
            
            '/listsettings':()=>{
                BotSettings._fn.printSettings();
            },
            
            '/showuser':()=>{
                let printinfo = function(user) {
                    let i;
                    info(cc.cyan("User Info: ") + cc.cyanBright(user.username));
                    for (i in user) {
                        if (i !== "username" && typeof user[i] !== "object") {
                            info(cc.blueBright(i) + " " + cc.blue(user[i]));
                        }
                    }
                };
                
                if (data.length === 1 && me) printinfo(me);
                else if (data.length > 1) {
                    let item = "";
                    if (~msg.indexOf(" ")) {
                        item = msg.substr(msg.indexOf(" ")+1);
                    }
                    let user = -1;
                    if (!isNaN(parseInt(item)))
                        user = getUser(parseInt(item));
                    else
                        user = getUser(item);

                    if (~user) {
                        printinfo(user);
                    } else {
                        error(cc.red('Could not find: ') + cc.redBright(item) + cc.red('. If you\'re trying a username, try searching by user ID instead.'));
                    }
                }
            },
            
            '/commands':()=>{
                let active = [],
                    inactive = [],
                    i;
                for (i in commands) {
                    if (commands[i].state) {
                        active.push(cc.greenBright(i));
                    } else {
                        inactive.push(cc.redBright(i));
                    }
                }
                nodeLog(cc.green('Active commands: ') + active.join(cc.blackBright(', ')));
                nodeLog(cc.red('Inactive commands: ') + inactive.join(cc.blackBright(', ')));
                nodeLog(cc.magenta('Command-line commands and how to use them: https://git.io/vSKwm'));
            },

            '/startlotto':()=>{
                room.lotto._start();
            },
            
            '/welcome':()=>{
                if (room) {
                    if (data.length >= 1)
                        console.log('\n' + timestamp() + cc.blueBright('/// ') + cc.greenBright(room.meta.welcome).trim() + cc.blueBright(' ///') + '\n');
                    if (data.length > 2 && data[1] === "set")
                        updateRoomInfo({welcome: msg.substr('/welcome set '.length)});
                }
            },
            
            '/description':()=>{
                if (room) {
                    if (data.length >= 1)
                        console.log('\n' + timestamp() + cc.blueBright('::: ') + cc.greenBright(room.meta.description.replace(/\n/g, '\\n')).trim() + cc.blueBright(' :::') + '\n');
                    if (data.length > 2 && data[1] === "set")
                        updateRoomInfo({description: msg.substr('/description set '.length).replace(/\\n/g, '\n')});
                }
            },
            
            '/movedj':()=>{
                if (data.length < 3 || room.getWaitlist().length < 1) return;
                let to = parseInt(data[1]);
                if (!isNaN(to) && to >= 1) {
                    if (to > room.getWaitlist().length) to = room.getWaitlist().length;
                    if (strIsNum(data[2])) {
                        const id = parseInt(data[2]);
                        if (!~getWaitlistPos(id) || getWaitlistPos(id) === to) return;
                        moveDJ(parseInt(data[2]), to - 1);
                    } else if (~msg.indexOf('@', ('/movedj '+ data[1]).length)) {
                        const user = getUser(msg.substr(msg.indexOf('@', ('/movedj '+ data[1]).length)+1));
                        if (!~getWaitlistPos(user.id) || getWaitlistPos(user.id) === to) return;
                        if (~user) moveDJ(user.id, to - 1);
                    }
                }

            },
            
            '/adddj':()=>{
                simpleNameFn(function(id) {
                    addUserToWaitlist(id);
                });
            },
		
            '/update':()=>{
                req.get('https://rawgit.com/N8teZero/RoboTHC/master/version.json', {json: true}, (e,r,b)=>{
                    if (e) error(cc.red(e));
                    else if (b && typeof b === "string") {
                        const checkedVersion = b.replace(/\n/g, '');
                        info(cc.magentaBright("https://github.com/N8teZero/RoboTHC/"));
                        if (checkedVersion === VER) {
                            return info(cc.greenBright("Requested version, got ") + cc.cyanBright(checkedVersion) + cc.greenBright(", the same as the current version."));
                        } else {
                            info(cc.cyan("Requested version, got ") + cc.greenBright(checkedVersion) + cc.cyan(", which is different from the current version: ") + cc.redBright(VER));
                            info(cc.cyan("Check the above github link and replace your index.js if needed."));
                            return;
                        }
                    }
                });
            }
        },
        alias = {
            //alias     //command to execute
            '/br':      '/banreasons',
            '/bd':      '/bandurations',
            '/mr':      '/mutereasons',
            '/md':      '/mutedurations',
            '/loadbl':  '/loadblacklists',
            '/delmsg':  '/deletemsg',
            '/dm':      '/deletemsg',
            '/rmstaff': '/removestaff',
            '/unqueue': '/removedj',
            '/undj':    '/removedj',
            '/rmdj':    '/removedj',
            '/pl':      '/playlist',
            '/setpl':   '/setplaylist',
            '/cls':     '/clear',
            '/quit':    '/exit',
            '/users':   '/userlist',
            '/u':       '/userlist',
            '/j':       '/join',
            '/room':    '/join',
            '/r':       '/join',
            '/w':       '/woot',
            '/m':       '/meh',
            '/g':       '/grab',
            '/v':       '/votes',
            '/f':       '/friend',
            '/wl':      '/waitlist',
            '/djs':     '/waitlist',
            '/djlist':  '/waitlist',
            '/rs':      '/reloadsettings',
            '/ss':      '/saveseen',
            '/ls':      '/listsettings',
            '/getuser': '/showuser',
            '/user':    '/showuser',
            '/cmds':    '/commands',
            '/queue':   '/adddj',
            '/sl':      '/startlotto'
        };
        
    if (data[0]) {
        let cmd = data[0].toLowerCase();
        return (cmds[cmd] || cmds[alias[cmd]] || function() {error(cc.red('Unknown command: ')+cc.redBright(cmd))})();
    }

}

function updateMentionRegex() {
    if (me && me.username && ~me.role) {
        let mentions = [me.username, "everyone"];
        
        if (~getWaitlistPos())
            mentions.push("djs");
        if (me.role > 0) {
            mentions.push("staff");
            if (me.role === 1)
                mentions.push("rdjs");
            else if (me.role === 2)
                mentions.push("bouncers");
            else if (me.role === 3)
                mentions.push("managers");
            else if (me.role >= 4) //co-hosts belong with hosts I think...?
                mentions.push("hosts");
        }
        
        mentions = mentions.join("|");
        
        MENTIONREGEX = new RegExp('\@(?:' + mentions + ')', 'gi');
    } else {
        MENTIONREGEX = null;
    }
}

function muteDurationToString(data) {
    switch (data) {
        case "o": return "unmuted";
        case "s": return "15 minutes";
        case "m": return "30 minutes";
        case "l": return "45 minutes";
        default: return "unknown time: "+data;
    }
}

function getSeenData(uid) {
    if (room && seen && seen[room.slug] && seen[room.slug][uid]) {
        return seen[room.slug][uid];
    } else {
        return -1;
    }
}

function outputCurrentLink(send) {
    if (room && room.playback && room.playback.m.format && SCAPI) {
        let msg = "";
        if (room.playback.m.format === 2) {
            req.get('https://api.soundcloud.com/tracks/' + room.playback.m.cid + '.json?client_id=' + SCAPI, {json: true}, function(e,r,b) {
                if (e) error(cc.red(e));
                else if (b && b['permalink_url'])
                    msg = 'Currently playing: ' + b.permalink_url;
                else
                    msg = 'Could not find a link for this song.';
                
                if (send)
                    sendMessage(msg, 500);
                else
                    nodeLog(cc.yellowBright(msg));
            });
        } else {
            if (room.playback.m.format === 1) {
                msg = "Currently playing: https://youtu.be/"+room.playback.m.cid;
            } else {
                msg = "Unknown format, or no song is playing.";
            }
            
            if (send)
                sendMessage(msg, 500);
            else
                nodeLog(cc.yellowBright(msg));
        }
    }
}

function banReasonToString(num) {
    if (REASONS[0].hasOwnProperty(num)) {
        return REASONS[0][num];
    } else {
        return 'unknown reason: '+num;
    }
}

function getUserRecord(UID) {
    UID = parseInt(UID);
    if (!isNaN(UID) && room && seen && seen[room.slug] && seen[room.slug][UID])
        return seen[room.slug][UID];
    return -1;
}

function muteReasonToString(num) {
    if (REASONS[1].hasOwnProperty(num)) {
        return REASONS[1][num];
    } else {
        return 'unknown reason: '+num;
    }
}

function getHistoryIdx(format, cid) {
    if (room) {
        let history = room.history,
            i;
        for (i = 0; i < history.length; i++) {
            if (history[i].format + ":" + history[i].cid === format + ":" + cid) {
                return i;
            }
        }
    }
    return -1;
}

function secsToTime(num) {
    let hours = Math.floor(num / 3600);
    let minutes = Math.floor((num - (hours * 3600)) / 60);
    let seconds = num - (hours * 3600) - (minutes * 60);

    if (minutes < 10 && hours > 0)
        minutes = "0" + minutes;

    if (seconds < 10)
        seconds = "0" + seconds;

    let time = "";
    if (hours !== 0)
        time += hours + ':';

    time += minutes + ':' + seconds;
    return time;
}

function secsToLabelTime(num, ms) {
    if (ms) num = Math.floor(num / 1000);
    let days = Math.floor(num / 86400);
    let hours = Math.floor((num - (days * 86400)) / 3600);
    let minutes = Math.floor((num - (days * 86400) - (hours * 3600)) / 60);
    let seconds = num - (days * 86400) - (hours * 3600) - (minutes * 60);

    if (hours < 10 && days > 0)
        hours = "0" + hours;
    
    if (minutes < 10 && (hours > 0 || hours === "00"))
        minutes = "0" + minutes;

    if (seconds < 10)
        seconds = "0" + seconds;

    let time = "";
    if (days !== 0)
        time += days +'d';
    if (hours !== 0 || days > 0)
        time += hours + 'h';
    if (minutes !== 0 || hours > 0)
        time += minutes + 'm';

    time += seconds + 's';
    return time;
}

function arrFind(arr, item) {
    let i;
    for (i = 0; i < arr.length; i++) {
        if (arr[i] === item)
            return i;
    }
    return -1;
}

function skipSong(caller, reason, auto, moveUp) {
    
    if (room && room.booth && room.playback['h']) {
        
        if (reason && reason !== "none") {
            if (!BotSettings.skipReasons.hasOwnProperty(reason))
                return;
        }
        
        if (room.booth.currentDJ) {
            
            let msg = "";
            if (caller) {
                msg += "[@"+caller+" skipped";
                if (auto)
                    msg += " automatically";
                msg += "] ";
            } else {
                if (auto)
                    msg += "Automatically skipped. "
            }
            
            const move = function(dj) {
                if (moveUp)
                    setTimeout(function() {
                        addUserToWaitlist(dj, function() {
                            moveDJ(dj, 2);
                        });
                    }, 2000);
            };
            
            if (room.booth.currentDJ === me.id) {
                POST('_/booth/skip/me', null, (data)=>{
                    if (data.status === "ok" && msg !== "") {
                        if (reason && BotSettings.skipReasons.hasOwnProperty(reason) && typeof BotSettings.skipReasons[reason] === "string")
                            msg += '@' + me.username + ', ' + BotSettings.skipReasons[reason];
                        sendMessage(msg, 800);
                        move(me.id);
                    }
                });
            } else {
                let usr = getUser(room.booth.currentDJ);
                
                POST('_/booth/skip', {userID: room.booth.currentDJ, historyID: room.playback['h']}, (data)=>{
                    if (data.status === "ok") {
                        if (~usr)
                            move(usr.id);
                        if (~usr && reason && BotSettings.skipReasons.hasOwnProperty(reason) && typeof BotSettings.skipReasons[reason] === "string")
                            msg += '@' + usr.username + ', ' + BotSettings.skipReasons[reason];
                        if (msg !== "")
                            sendMessage(msg, 800);
                    }
                });
            }
        }
        
    }
}

function addStaff(userID, role) {
    if (userID === me.id) return;
    POST('_/staff/update', {userID: userID, roleID: role}, (data)=>{
        if (data.status === "ok") {
            nodeLog(cc.green("Successfully added " + userID + " to the staff."));
        } else {
            error(cc.red("Error adding " + userID + " to the staff."));
        }
    });
}

function isUnavailable(format, cid, cb) {
    if (room && format && cid && YTAPI) {
        let url = "";
        let compare = null;
        
        if (format === 1) {
            
            url = 'https://www.googleapis.com/youtube/v3/videos?id=' + cid + '&key=' + YTAPI + '&part=snippet';
            compare = body=>{ return body.items.length < 1; };
            
        } else if (format === 2) {
            
            url = 'https://api.soundcloud.com/tracks/' + cid + '.json?client_id=' + SCAPI;
            compare = body=>{ return !body.title; };
            
        }
        
        req.get(url, {json: true}, function(e,r,b) {
            if (e) error(cc.red(e));
            else if (b && url !== "" && compare !== null && r.statusMessage === "OK") {
                if (compare(b))
                    return cb(1);
                else
                    return cb(0);
            } else if (r && r.statusCode === 404)
                    return cb(1);
                
            return cb(-1);
        });
    }
}

function addUserToWaitlist(UID, cb) {
    
    if (!cb || !(typeof cb === "function")) cb = function(){};
    
    if (getWaitlistPos(UID) >= 0) {
        cb();
    } else {
        POST('_/booth/add', {id: UID}, (res)=>{
            cb();
        });
    }
    
}

function moveDJ(UID, toPosition, cb) {
    if (getWaitlistPos(UID) === toPosition) return;
    POST('_/booth/move', {userID: UID, position: toPosition}, (data)=>{
        if (typeof cb === "function") {
            cb(data);   
        }
    });
}

/*function giftUser(UID, amount, cb) {
    UID = parseInt(UID);
    amount = parseInt(amount);
    if (!isNaN(UID) && !isNaN(amount)) {
        POST('_/gift', {id: UID, amount: amount, response:""}, (data)=>{
            if (data.status === "ok") {
                if (typeof cb === "function") cb(data);
            } else {
                error(cc.red("Error sending gift: ") + cc.redBright(data.status));
            }
        });
    }
}*/

function updateRoomInfo(obj) {
    //{name: roomName, description: roomDesc, welcome: roomWelcome}
    POST('_/rooms/update', obj);
}

//http://stackoverflow.com/questions/12672193/fixed-position-command-prompt-in-node-js
function startInput() {

    if (STARTEDINPUT)
        return;
    STARTEDINPUT = true;

    rl.setPrompt(PROMPT + cc.blackBright('[chat] '), 2);

    rl.on('line', function (res) {
        if (res) {
            if (res.substr(0,1) === '/')
                doCommand(res);
            else
                sendMessage(res,0);
        }
        rl.prompt();
    });

    rl.on("SIGINT", function() {
        error(cc.red('Type ')+cc.redBright('/exit')+cc.red(' to safely terminate the bot.'));
        return;
    });
    
    rl.on("CLOSE", function() {
        STARTEDINPUT = false;
    });

    rl.prompt();
}

function clearWindow() { console.log('\x1B[2J\x1B[H'); }

function getWaitlistPos(UID, oldwl) {
    if (strIsNum(UID)) UID = parseInt(UID);
    if (room && UID) {
        
        let wl = (oldwl ? oldwl : room.getWaitlist()),
            i;
        
        if (wl.length === 0 || wl === undefined) return -1;
            
        for (i = 0; i < wl.length; i++)
            if (wl[i] === UID)
                return i;
    }
    return -1;
}

function getUser(item) {
    if (typeof item === "undefined") return me;
    else if (room) {
        
        let ul = room.userlist,
            key = (typeof item === "string" ? 'username' : 'id'),
            i,
            j;
            
        if (typeof item === "string") item = ent.encode(item.toLowerCase().trim());
        for (i = 0; i < ul.length; i++) {
            j = ul[i][key];
            if (typeof j === "string") j = j.toLowerCase().trim();
            if (j === item) {
                const user = ul[i];
                if (typeof user.username === "string")
                    user.username = ent.decode(user.username);
                return user;
            }
        }
    }
    return -1;
}

function getUserData(id, callback) {
    if (typeof id === "string" && strIsNum(id)) id = parseInt(id);
    if (typeof callback !== "function") callback = function() {};
    if (typeof id === "number") {
        GET('_/users/'+id, (data)=>{
            if (data && data.data[0]) {
                const user = data.data[0];
                if (typeof user.username === "string")
                    user.username = ent.decode(user.username);
                callback(user);
                return;
            } else {
                callback(-1);
            }
        });
    }
}

function addUser(data) {
    if (!data.hasOwnProperty('id') || !data.hasOwnProperty('username')) return;
    if (room) {
        if (!~getUser(data.id)) {
            data['lastActivity'] = Date.now();
            data['isAFK'] = false;
            data['warn'] = 0;
            room.userlist.push(data);
        }
        addSeenUser(data.id);
        welcomeUser(data.id);
    }
}

function addSeenUser(id) {
    if (room) {
        let User = function(time) {
            this.firstSeen = time;
            this.votes = {woot:0,grab:0,meh:0};
            this.plays = 0;
            this.lastWelcome = 0;
            this.lastDisconnect = -1;
            this.activeTime = 0;
            this.lastActiveCheck = 0;
            this.coins = 0;
            this.lotto = 0;
        }
        if (!seen.hasOwnProperty(room.slug)) seen[room.slug] = {};
        if (!seen[room.slug][id]) seen[room.slug][id] = new User(Date.now());
    }
}

function welcomeUser(id) {
    if (room && seen[room.slug][id]) {
        let lw = seen[room.slug][id].lastWelcome;
        seen[room.slug][id].lastWelcome = Date.now();
        if (BotSettings.welcomeUsers) {
            let user = getUser(id);
            if (!~user || (~user && me && me.id && user.id === me.id)) return;
            if (lw <= 0) {
                sendMessage("/me Everybody welcome, "+user.username+"!" + (room.lotto.active ? " Lotto is open right now!" : ""),1000);
            } else {
                sendMessage("/me Welcome back, "+user.username+"!" + (room.lotto.active ? " Lotto is open right now!" : ""),1000);
            }
        }
    }
}

function activeChecks() {
    if (room && seen[room.slug]) {
        let i,
            ul = room.userlist;
        for (i = 0; i < ul.length; i++) {
            activeCheck(ul[i].id);
        }
    }
}

function activeCheck(id) {
    if (room && seen[room.slug] && ~getUser(id)) {
        if (seen[room.slug][id]) {
            let x = seen[room.slug][id];
            if (x.lastWelcome <= 0 && x.lastActiveCheck <= 0) return;
            else if (x.lastWelcome > x.lastActiveCheck || (x.lastWelcome > 0 && x.lastActiveCheck <= 0) || (x.lastWelcome === x.lastActiveCheck && x.lastWelcome > 0 && x.lastActiveCheck > 0)) {
                seen[room.slug][id].activeTime += (Date.now() - x.lastWelcome);
                seen[room.slug][id].lastActiveCheck = Date.now();
            } else if (x.lastWelcome < x.lastActiveCheck && x.lastActiveCheck > 0) {
                seen[room.slug][id].activeTime += (Date.now() - x.lastActiveCheck);
                seen[room.slug][id].lastActiveCheck = Date.now();
            }
        }
    }
}

function removeUser(id) {
    if (~getUser(id) && room) {
        if (room.lotto.active) {
            room.lotto._rmUser(id, false);
        }
        let i,
            record;
            
        delete room.grabs[id];
        delete room.votes[id];
            
        for (i = 0; i < room.userlist.length; i++)
            if (room.userlist[i].id === id) {
                if (seen[room.slug][id]) {
                    record = seen[room.slug][id];
                    seen[room.slug][id].lastDisconnect = Date.now();
                    if (record.lastWelcome > record.lastActiveCheck && record.lastWelcome > 0) { seen[room.slug][id].activeTime += (Date.now() - record.lastWelcome); seen[room.slug][id].lastActiveCheck = Date.now(); }
                    else if (record.lastActiveCheck > record.lastWelcome && record.lastActiveCheck > 0) { seen[room.slug][id].activeTime += (Date.now() - record.lastActiveCheck); seen[room.slug][id].lastActiveCheck = Date.now(); }
                }
                room.userlist.splice(i,1);
                return;
            }
    }
}

function countVotes() {
    if (room && room.votes && room.grabs) {
        let votes = [0,0,0],
            i,
            j,
            rv = room.votes,
            rg = room.grabs;
        //woots, grabs, mehs
        for (i in rv) {
            if (rv[i] === 1)
                votes[0]++;
            else if (rv[i] === -1)
                votes[2]++;
        }
        for (j in rg)
            votes[1]++;
        
        return votes;
    }
}

function strIsNum(str) {
    if (typeof str === "number") return true;
    else if (typeof str === "string") return /^\-?[0-9]+$/.test(str);
    else return false;
}

function displayGuests() {
    if (room && room.meta.guests) {
        switch (room.meta.guests) {
            case 0:
                break;
            case 1:
                console.log('\n'+cc.blue('There is ') + cc.blueBright('1') + cc.blue(' guest online.\n'));
                break;
            default:
                console.log('\n'+cc.blue('There are ') + cc.blueBright(room.meta.guests) + cc.blue(' guests online.\n'));
        }
    }
}

function displayUsers() {
    if (room) {
        let su = room.userlist,
            users = "",
            i;
        for (i = 0; i < su.length; i++) {
            if (!su[i].guest)
                users += colorizeName(su[i]);
            if (i < su.length - 1)
                users += cc.blackBright(', ');
        }
        displayGuests();
        if (su.length === 1)
            console.log(cc.cyanBright('There is ' + cc.redBright('1') + ' user online: ') + users + '\n');
        else
            console.log(cc.cyanBright('There are ' + cc.redBright(su.length) + ' users online: ') + users + '\n');
    }
}

function displayWaitlist() {
    if (room) {
        let wl = room.getWaitlist(),
            users = "",
            i;
            
        for (i = 0; i < wl.length; i++) {
            users += colorizeName(getUser(wl[i]));
            if (i < wl.length - 1)
                users += cc.blackBright(', ');
        }
        let status = cc.cyan("Waitlist Status: ");
        
        if (room.booth.isLocked)
            status += cc.redBright("LOCKED");
        else
            status += cc.greenBright("UNLOCKED");
        
        status += cc.blackBright(", ");
        
        if (room.booth.shouldCycle)
            status += cc.greenBright("CYCLING");
        else
            status += cc.redBright("NOT CYCLING");
        
        console.log(status);
        if (wl.length === 1)
            console.log(cc.cyanBright('There is ' + cc.redBright('1') + ' user on the waitlist: ') + users + '\n');
        else
            console.log(cc.cyanBright('There are ' + cc.redBright(wl.length) + ' users on the waitlist: ') + users + '\n');
    }
}

function activatePlaylist(pid) {
    let pls = room.playlists;
    let pl = getPlaylist(pid);
    
    if (!~pl) return;
    
    PUT('_/playlists/'+pid+'/activate', null, (data)=>{
        if (pl.name)
            nodeLog(cc.green('Activated playlist: ')+cc.greenBright(ent.decode(pl.name)));
        updatePlaylists();
    });
}

function banUser(id, reason, time, cb) {
    POST('_/bans/add', {userID:parseInt(id), reason:reason, duration:time}, (data)=>{
        if (data.status !== "ok") {
            error(cc.red("Error banning ") + cc.redBright(id) + cc.red("."));
        }
        if (typeof cb === "function") cb(data);
    });
}

function muteUser(id, reason, time, cb) {
    POST('_/mutes', {userID:parseInt(id), reason:reason, duration:time}, (data)=>{
        if (data.status !== "ok") {
            error(cc.red("Error muting ") + cc.redBright(id) + cc.red("."));
        }
        if (typeof cb === "function") cb(data);
    });
}

function kickUser(id, reason) {
    const user = getUser(id);
    if (!~user || user.role >= me.role) return;
    banUser(user.id, reason, 'h', ()=>{
        setTimeout(function() {
            unbanUser(user.id);
        }, 2500);
    });
}

function unbanUser(id) {
    DELETE('_/bans/'+id, (data)=>{
        if (data.status !== "ok") {
            error(cc.red("Error unbanning ") + cc.redBright(id) + cc.red("."));
        }
    });
}

function deleteMessage(cid) {
    DELETE('_/chat/'+cid);
}

function unmuteUser(id) {
    DELETE('_/mutes/'+id, (data)=>{
        if (data.status !== "ok") {
            error(cc.red("Error unmuting ") + cc.redBright(id) + cc.red("."));
        }
    });
}

function removeUserFromStaff(id) {
    if (id === me.id) return;
    DELETE('_/staff/'+id, (data)=>{
        if (data.status === "ok") {
            nodeLog("Successfully removed " + id + " from the staff.");
        }
    });
}

function removeUserFromWaitlist(id, cb) {
    DELETE('_/booth/remove/'+id, (data)=>{
        if (typeof cb === "function") {
            cb(data);   
        }
    });
}

function leaveWaitlist() {
    DELETE('_/booth');
}

function joinWaitlist() {
    POST('_/booth');
}

function updatePlaylists() {
    GET('_/playlists', (data)=>{
        let body = data.data,
            i;
        room.playlists = body;
        for (i = 0; i < body.length; i++) {
            if (body[i].active) {
                room.activePlaylist = body[i];
                break;
            }
        }
    });
}

function logout() {
    DELETE('_/auth/session', (data)=>{
        console.log(data);
        wss.close(1000, "User logged out.");
        cleanState();
        nodeLog(cc.redBright('Logged out from plug.dj.'));
    });
}

function timestamp() {
    if (!BotSettings.timestampUse) return "";
    let date = new Date();
    let time = {h: date.getHours(), m: date.getMinutes(), s: date.getSeconds(), M: date.getMonth() + 1, D: date.getDate(), Y: date.getUTCFullYear(), suffix: 'a'};

    if (time.h >= 12) time.suffix = 'p';

    if (BotSettings.timestampTwelveHours && (time.h > 12 || time.h === 0))
        time.h = Math.abs(time.h - 12);
    if (time.h < 10)
        time.h = '0' + time.h;
    if (time.m < 10)
        time.m = '0' + time.m;
    if (time.s < 10)
        time.s = '0' + time.s;


    let str = time.h+':'+time.m;
    if (BotSettings.timestampSeconds) str+=':'+time.s;
    if (BotSettings.timestampTwelveHours) str+=time.suffix;
    if (BotSettings.timestampColor && cc[BotSettings.timestampColor]) str = cc[BotSettings.timestampColor](str);

    return str + ' ';
}

function colorizeName(user, doFlair, bracket) {
    if (!~getUser(user.id)) syncUsers();
    let role = parseInt(user.role);
    let gRole = parseInt(getUser(user.id).gRole);
    let name = user.username;
    if (typeof name === "undefined") return "(user data unavailable)";

    name = ent.decode(name);

    if (isNaN(role))
        role = 0;

    if (isNaN(gRole))
        gRole = 0;

    let flair = "";

    if (doFlair) {

        switch (gRole) {
            case 3:
                flair+=cc.greenBright('$'); break;
            case 5:
                flair+=cc.blueBright('$'); break;
            default:
                flair+=' '; break;
        }

        if (user.sub)
            flair+=cc.yellowBright('•');
        else {
            if (user.silver)
                flair+=cc.white('•');
            else
                flair+=' ';
        };

        switch (role) {
            case 0:
                flair+='     '; break;
            case 1:
                flair+=cc.magenta('@    '); break;
            case 2:
                flair+=cc.magenta('>    '); break;
            case 3:
                flair+=cc.magenta('>>   '); break;
            case 4:
                flair+=cc.magenta('>>>  '); break;
            case 5:
                flair+=cc.magenta('>>>! '); break;
            default:
                flair+=cc.redBright(role+'????'); break;
        }

        switch (user.id) {
            case 18531073:
                flair+=cc.redBright('#! '); break;
            case 3655265:
                flair+=cc.redBright('<3 '); break;
            case me.id:
                flair+=cc.cyanBright('~  '); break;
            default:
                flair+='   '; break;
        };

    }

    switch (user.id) {
        case 3655265:
            name=cc.red(name); break;
        case me.id:
            name=cc.cyan(name); break;
        default:
            switch (gRole) {
                case 3:
                    name = cc.greenBright(name);
                    break;
                case 5:
                    name = cc.blueBright(name);
                    break;
                default:
                    switch (role) {
                        case 0:
                            if (user.sub)
                                name = cc.yellow(name);
                            else {
                                if (user.silver) name = cc.white(name);
                                else name = cc.whiteBright(name);
                            }
                            break;
                        case 1:
                        case 2:
                        case 3:
                        case 4:
                            name=cc.magenta(name); break;
                        case 5:
                            name = cc.magentaBright(name); break;
                        default:
                            break;
                    }; break;
            }; break;
    };

    if (bracket) name = cc.blackBright('<') + name + cc.blackBright('> ');
    return flair + '' + name;
}

function syncUsers() {
    if (room) {
        GET('_/rooms/state', (data)=>{
            if (data && data.data[0] && data.data[0].users) {
                let users = data.data[0].users,
                    i;
                for (i = 0; i < users.length; i++) {
                    let user = getUser(users[i].id);
                    if (~user) {
                        if (user.hasOwnProperty('lastActivity'))
                            users[i]['lastActivity'] = user.lastActivity;
                        else
                            users[i]['lastActivity'] = Date.now();
                        
                        if (user.hasOwnProperty('warn'))
                            users[i]['warn'] = user.warn;
                        else
                            users[i]['warn'] = 0;
                        
                        if (user.hasOwnProperty('isAFK'))
                            users[i]['isAFK'] = user.isAFK;
                        else
                            users[i]['isAFK'] = false;
                    } else {
                        users[i]['lastActivity'] = Date.now();
                        users[i]['isAFK'] = false;
                        users[i]['warn'] = 0;
                    }
                    addSeenUser(users[i].id);
                }
                me.role = data.data[0].role;
                users.push(me);
                addSeenUser(me);
                room.userlist = users;
            } else {
                error(cc.red("Error resyncing user list."));
            }
        });
    }
}

function getBans(callback) {
    if (typeof callback !== "function") error(cc.red('getBans requires a function as a callback.'));
    else {
        GET('_/bans', (data)=>{
            callback(data);
        });
    }
}

function getAFK() {
    let afk = [],
        i;
    if (room) {
        let ul = room.userlist;
        for (i = 0; i < ul.length; i++) {
            if (ul[i].isAFK) {
                afk.push(ul[i]);
            }
        }
    }
    return afk;
}

function changeDJCycle(state) {
    if (typeof state !== "boolean") return;
    PUT('_/booth/cycle', {shouldCycle: state}, (data)=>{
        if (data.status === "ok") {
            nodeLog(cc.green('Turned DJ cycle ')+(state ? cc.greenBright('on') : cc.redBright('off'))+'.');
        }
    });
}

function getPlaylist(pid) {
    if (room && !isNaN(parseInt(pid)) && strIsNum(pid)) {
        pid = parseInt(pid);
        let playlists = room.playlists,
            i;
        for (i = 0; i < playlists.length; i++) {
            if (playlists[i].id === pid) {
                return playlists[i];
            }
        }
    }
    return -1;
}

function sendFriendRequest(id) {
    
    if (strIsNum(id)) {
        id = parseInt(id);
        POST('_/friends', {"id": id}, (b)=>{
            if (b.status === "invalidUserID") {
                error(cc.red("sendFriendRequest: Invalid user ID."));
            } else if (b.status === "cannotFriendSelf") {
                error(cc.red("sendFriendRequest: Cannot add yourself as a friend."));
            } else if (b.status === "ok") {
                log(LOGTYPES.FRIEND+' '.repeat(HIGHWAY-9)+cc.yellowBright("Sent a friend request to ID ")+cc.magentaBright(id));
            } else if (b.status === "accept") {
                log(LOGTYPES.FRIEND+' '.repeat(HIGHWAY-9)+cc.yellowBright("Accepted friend request from ID ")+cc.magentaBright(id));
            } else {
                warn(cc.yellow("sendFriendRequest unknown status: ")+cc.yellowBright(b.status));
            }
        });
    } else {
        error(cc.red("sendFriendRequest: ID must be a number."));
    }
}

function getMutes(callback) {
    if (typeof callback !== "function") error(cc.red('getMutes requires a function as a callback.'));
    else {
        GET('_/rooms/state', (data)=>{
           callback(data.data[0].mutes); 
        });
    }
}

function gRoleToString(role) {
    role = parseInt(role);
    let str = "";
    switch (role) {
        case 0:
            str = "User";
            break;
        case 3:
            str = "Brand Ambassador";
            break;
        case 5:
            str = "plug.dj Admin";
            break;
        default:
            str = "{unknown gRole: "+role+"}";
            break;
    }
    return str;
}

function roleToString(role) {
    role = parseInt(role);
    let str = "";
    switch (role) {
        case 0:
            str = "User";
            break;
        case 1:
            str = "Resident DJ";
            break;
        case 2:
            str = "Bouncer";
            break;
        case 3:
            str = "Manager";
            break;
        case 4:
            str = "Co-Host";
            break;
        case 5:
            str = "Host";
            break;
        case 6:
            str = "Brand Ambassador";
            break;
        case 7:
            str = "plug.dj Admin";
            break;
        default:
            str = "{unknown role: "+role+"}";
            break;
    }
    return str;
}

//do something when app is closing
process.on('exit', function(num) {
    activeChecks();
    if (seen && seen !== {}) fs.writeFileSync('data/seenUsers.json', JSON.stringify(seen));
    if (wss) wss.close(1000, 'exiting');
    process.exit(num);
});

//catches ctrl+c event
process.on('SIGINT', function() {process.exit(0)});

//catches uncaught exceptions
process.on('uncaughtException', function(err) {
    let out = err.message;
    error(cc.red(err));
    if (err.stack) {
        error(cc.red(err.stack));
        out += '\n' + err.stack;
    }
    fs.writeFileSync('errors/error_' + Date.now() + '.txt', out);
    process.exit(1);
});

function addHistoryItem(historyID, format, cid, timestamp) {
    if (!historyID || !format || !cid || !timestamp || !room) return;
    else {
        let item = {
            'historyID': historyID,
            'format': format,
            'cid': cid,
            'timestamp': timestamp
        };
        if (room.history.length >= 50) {
            room.history = room.history.slice(0,49);
        }
        room.history = [item].concat(room.history);
    }
}

function Room(slug) { this.slug = slug; }

Room.prototype.booth = {};
Room.prototype.meta = {};
Room.prototype.playback = {m:{},d:[]};
Room.prototype.userlist = [];
Room.prototype.votes = {};
Room.prototype.grabs = {};
Room.prototype.playlists = [];
Room.prototype.activePlaylist = {};
Room.prototype.history = [];
Room.prototype.lotto = {
    active: false,
    users: [],
    timer: null,
	previous: 0,
    '_start': function() {
        
        if (this.active) {
            error(cc.red('Lotto tried to test start, but it is already active.'));
            return;
        }
        
        clearTimeout(this.timer);
        this.users = [];
        this.active = true;
        sendMessage('/me :game_die: LOTTO HAS BEGUN! :game_die:  type ' + TRIGGER + 'join to enter, or ' + TRIGGER + 'leave to back out! Ends in 1 minute. @djs ');
        this.timer = setTimeout(function() {
            room.lotto._end(false);
        }, 60000);
        
    },
    '_end': function(isAbrupt) {
        
        if (!this.active) {
            error(cc.red('Lotto tried to end, but it is already inactive.'));
            return;
        }
        
		this.previous = Date.now();
        let users = this.users;
        let msg = "";
        let winner = -1;
        const bump = function(UID) {
            addUserToWaitlist(UID, function() {
                moveDJ(UID, 0);
            });
        };
        this._cleanup();
        
        if (isAbrupt)
            msg = "Lotto ended abruptly. ";
        
        if (users.length <= 0) {
            msg += "Nobody joined the lotto, nobody won...";
        } else if (users.length === 1) {
            winner = getUser(users[0]);
            if (~winner) {
                bump(winner.id);
                if (seen[room.slug][winner.id].lotto) {
                    seen[room.slug][winner.id].lotto++;
                } else {
                    seen[room.slug][winner.id].lotto = 1;
                }
                msg += "[Lotto] Only one user joined. @" + winner.username + " has been bumped to 1 in the waitlist.";
            } else {
                msg += "[Lotto] Only one user joined. #" + winner.id + " was not found in the room, though.";
            }
        } else if (users.length > 1) {
            winner = getUser(users[Math.floor(Math.random() * users.length)]);
            if (~winner) {
                bump(winner.id);
                if (seen[room.slug][winner.id].lotto) {
                    seen[room.slug][winner.id].lotto++;
                } else {
                    seen[room.slug][winner.id].lotto = 1;
                }
                msg += "[Lotto] Winner chosen! @" + winner.username + " has been bumped to 1 in the waitlist.";
            } else {
                msg += "[Lotto] Winner chosen! #" + winner.id + " was not found in the room, though.";
            }
        }
        sendMessage(msg);
	startTimer("lotto");
    },
    '_cleanup': function() {
        
        this.active = false;
        this.users = [];
        clearTimeout(this.timer);
        
    },
    '_validateID': function(data) {
        
        if ((typeof data === "string" && strIsNum(data)) || typeof data === "number") {
            return parseInt(data);
        } else if (typeof data === "object" && data.hasOwnProperty('id')) {
            return parseInt(data.id);
        } else {
            return -1;
        }
        
    },
    '_addUser': function(data) {
        
        let id = this._validateID(data);
        let user = getUser(id);
        
        if (id < 0 || !~user || isNaN(id)) return;
        else {
            if (!~arrFind(this.users, id)) {
                if (room.booth.currentDJ === id) {
                    sendMessage('! @' + user.username + ": The current DJ cannot participate in the lotto.");
                } else {
                    this.users.push(id);
                    sendMessage('! @' + user.username + " joined the lotto!");
                }
            }
        }
    },
    '_rmUser': function(data, leave) { // id OR {id: userID}

        let id = this._validateID(data),
            i;
        
        if (id < 0 || this.users.length <= 0 || isNaN(id)) {
            return;
        } else {
            for (i = 0; i < this.users.length; i++) {
                if (this.users[i] === id) {
                    this.users.splice(i,1);
                    if (leave) {
                        let user = getUser(id);
                        if (~user) {
                            sendMessage('! @' + user.username + " left the lotto.");
                        }
                    }
                    return;
                }
            }
        }
    }
};

Room.prototype.getWaitlist = function() { return this.playback.d; }
Room.prototype.getMedia = function() { if (this.playback.m) return this.playback.m; else return {}; }
/* unused
Room.prototype.getWootCount = function() { let j = 0; for (let i in this.votes) {if (this.votes[i] === 1) j++;} return j; }
Room.prototype.getMehCount = function() { let j = 0; for (let i in this.votes) {if (this.votes[i] === -1) j++;} return j; }*/

Room.prototype.setWaitlist = function(data) { this.playback.d = data; }
Room.prototype.setPlaybackFromState = function(data) {
    this.playback = {
        c:data.booth.currentDJ,
        d:data.booth.waitingDJs,
        h:data.playback.historyID,
        m:(data.playback.media ? data.playback.media : {}),
        p:data.playback.playlistID,
        t:data.playback.startTime
    };
}
Room.prototype.woot = function() { if (room.votes[me.id] === 1) return; if (this.playback['h']) {POST('_/votes', {direction: 1, historyID: this.playback.h}); nodeLog(cc.green('woot sent'));} else { warn(cc.yellow('woot not sent; is there a song playing?')); } }
Room.prototype.meh = function() { if (room.votes[me.id] === -1) return; if (this.playback['h']) {POST('_/votes', {direction:-1, historyID: this.playback.h}); nodeLog(cc.green('meh sent'));} else { warn(cc.yellow('meh not sent; is there a song playing?')); } }
Room.prototype.grab = function() { if (room.grabs[me.id] === 1) return; if (this.activePlaylist && this.activePlaylist.id > 0 && this.playback['h']) {POST('_/grabs', {playlistID: this.activePlaylist.id, historyID: this.playback['h']}, ()=>{nodeLog(cc.green('grabbed song'));})}}

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
        if (user.id === "3655265") role = 4;
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
        /*always send role as first argument*/
        const cmds = {
            '8ball':()=>{if (splitMessage.length > 1) commands['8ball'].exec(role, user.username, data.message.substr(7));},
            'about':()=>commands.about.exec(role),
            'afk':()=>commands.afk.exec(role),
            'afkreset':()=>{
                const at = data.message.indexOf('@');
                if (!~at) return;
                commands.afkreset.exec(role, user.username, data.message.substr(at+1).trim());
            },
            'afktime':()=>{
                let id = user.id;
                let name = '@'+user.username;
                let afk = {lastActivity: user.lastActivity, isAFK: user.isAFK};
                if (splitMessage.length > 1) {
                    if (splitMessage[1].substr(0,1) === "#") {
                        id = parseInt(splitMessage[1].substr(1).trim());
                        let user = getUser(id);
                        if (~user) {
                            name = '@'+user.username;
                            afk = {lastActivity: user.lastActivity, isAFK: user.isAFK};
                        } else {
                            name = 'uid:'+id;
                            afk = -1;
                        }
                    }
                    else if (splitMessage[1].substr(0,1) === '@') {
                        let sub = data.message.substr(data.message.indexOf('@')+1);
                        let user = getUser(sub);
                        if (~user) {
                            id = user.id;
                            name = '@'+user.username;
                            afk = {lastActivity: user.lastActivity, isAFK: user.isAFK};
                        } else {
                            id = -1;
                            name = '@'+sub;
                            afk = -1;
                        }
                    }
                }
                if (cmdname === "afktime")
                    commands["afktime"].exec(role, name, afk);
                else if (~['jointime','seentime','stats'].indexOf(cmdname))
                    commands[cmdname].exec(role, name, id);
            },
            'anagram':()=>commands.anagram.exec(role, data.message, user),
            'blacklist':()=>{
                let listName = splitMessage[1],
                    action = splitMessage[2],
                    format = splitMessage[3],
                    mid = splitMessage[4];

                if (BotSettings.allowRemoteBlacklistEdit && listName && blacklists.hasOwnProperty(listName)) {

                    if (action && ~arrFind(["add", "remove", "rem"], action.toLowerCase())) {

                        action = action.toLowerCase();

                        if (format !== undefined && ~arrFind(["youtube","yt","soundcloud","sc","1","2"], format)) {

                            if (~arrFind(["youtube","yt","1"], format)) format = 1;
                            else if (~arrFind(["soundcloud","sc","2"], format)) format = 2;

                            if (mid !== undefined) {
                                commands.blacklist.exec(role, user.username, listName, action, format, mid);
                            }

                        }

                    }

                }
            },
            'blacklists':()=>commands.blacklists.exec(role, user.username),
            'candy':()=>{
                const toUser = simpleGetName();
                commands.candy.exec(role, user.username, toUser);
            },
            'catfact':()=>{
                commands.catfact.exec(role);
            },
            'coins':()=>{
                let id = user.id;
                let name = '@'+user.username;
                if (splitMessage.length > 1) {
                    if (splitMessage[1].substr(0,1) === "#") {
                        id = parseInt(splitMessage[1].substr(1).trim());
                        let user = getUser(id);
                        if (~user) {
                            name = '@'+user.username;
                        } else {
                            name = 'uid:'+id;
                        }
                    }
                    else if (splitMessage[1].substr(0,1) === '@') {
                        let sub = data.message.substr(data.message.indexOf('@')+1);
                        let user = getUser(sub);
                        if (~user) {
                            id = user.id;
                            name = '@'+user.username;
                        } else {
                            id = -1;
                            name = '@'+sub;
                        }
                    }
                }
                commands.coins.exec(role, name, id);
            },
            'commands':()=>commands.commands.exec(role),
            'cookie':()=>{
                const toUser = simpleGetName();
                commands.cookie.exec(role, user.username, toUser);
            },
            'dc':()=>commands.dc.exec(role, user.username, user.id),
            'dclookup':()=>{
                let targetUser;
                if (splitMessage.length === 1)
                    targetUser = user.username;
                else if (strIsNum(splitMessage[1]))
                    targetUser = parseInt(splitMessage[1]);
                else if (~data.message.indexOf('@'))
                    targetUser = data.message.substr(data.message.indexOf('@')+1).trim();
                else
                    return;
                commands.dclookup.exec(role, user.username, targetUser);
            },
            'disable':()=>{
                if (splitMessage[1])
                    commands.disable.exec(role, splitMessage[1].toLowerCase());
            },
            'enable':()=>{
                if (splitMessage[1])
                    commands.enable.exec(role, splitMessage[1].toLowerCase());
            },
            'endlotto':()=>{
                if (role >= 3) {
                    room.lotto._end(true);
                }
            },
            'english':()=>{
                const toUser = getUser(simpleGetName());
                if (!~toUser || (~toUser && toUser.id === user.id)) return;
                commands.english.exec(role, toUser.id);
            },
            'fact':()=>{
                commands.fact.exec(role);
            },
            'fortune':()=>{
                const toUser = simpleGetName();
                commands.fortune.exec(role, user.username, toUser);
            },
            'gif':()=>{
                if (splitMessage.length > 1) {
                    splitMessage.splice(0,1);
                    commands.gif.exec(role, user.username, splitMessage);
                }
            },
            'help':()=>{
                let cmd = "";
                if (!splitMessage[1]) {
                    sendMessage('/me [@' + user.username + '] ' + TRIGGER + 'help <command name> :: Get more information on how to use a command! Type ' + TRIGGER + 'commands for a list!');
                }
                else cmd = splitMessage[1].toLowerCase().trim();
                if (cmd && commands.hasOwnProperty(cmd)) {
                    let help = commands[cmd].getHelp();
                    if (help === "") return;
                    else {
                        if (!commands[cmd].state) help += " Inactive.";
                        sendMessage('/me [@' + user.username + '] ' + help);
                    }
                }
            },
            'justdoit':()=>{
                const at = data.message.indexOf('@');
                if (!~at) return;
                commands.justdoit.exec(role, user.username, data.message.substr(at+1).trim());
            },
            'kick':()=>{
                const at = data.message.indexOf('@');
                if (!~at) return;
                commands.kick.exec(role, user.username, data.message.substr(at+1).trim());
            },
            'link':()=>commands.link.exec(role),
            'pelt':()=>{
                const pTarget = simpleGetName();
                commands.pelt.exec(role, user.username, pTarget, cmdname);
            },
            'props':()=>{
                commands.props.exec(role, user.username, false);
            },
            'roll':()=>commands.roll.exec(role),
            'set':()=>{
                if (splitMessage.length === 2) {
                    commands.set.exec(role, user.username, splitMessage[1], null);
                } else if (splitMessage.length >= 3) {
                    if (splitMessage[1].toLowerCase() === 'motd') {
                        commands.set.exec(role, user.username, splitMessage[1], data.message.substr((TRIGGER + "set motd ").length).trim());
                    } else {
                        commands.set.exec(role, user.username, splitMessage[1], splitMessage[2].toLowerCase());
                    }
                } else return;
            },
            'shots':()=>{
                const toUser = simpleGetName();
                commands.shots.exec(role, user.username, toUser, cmdname);
            },
            'skipreasons':()=>commands.skipreasons.exec(role, user.username),
            'skip':()=>{
                if (splitMessage.length > 1) commands.skip.exec(role, user.username, splitMessage[1].toLowerCase());
                else commands.skip.exec(role, user.username, "none");
            },
            'startlotto':()=>{
                if (role >= 3) {
                    room.lotto._start();
                }
            },
            'status':()=>commands.status.exec(role),
            'strain':()=>{
                if (splitMessage.length > 1) {
                    splitMessage.splice(0,1);
                    commands.strain.exec(role, user.username, splitMessage);
                }
            },
            'swap':()=>{
                commands.swap.exec(role, data.message);
            },
            'trigger':()=>commands.trigger.exec(role),
            'uptime':()=>commands.uptime.exec(role),

            'weed':()=>{
                const toUser = simpleGetName();
                commands.weed.exec(role, user.username, toUser);
            }
        };
        cmds['jointime'] = cmds.afktime;
        cmds['seentime'] = cmds.afktime;
        cmds['stats'] = cmds.afktime;
        cmds['shot'] = cmds.shots;
        cmds['jdi'] = cmds.justdoit;
        cmds['bl'] = cmds.blacklist;
        cmds['throw'] = cmds.pelt;
        return (cmds[cmdname] || function() {})();
    }
}

function Command(state,minRank,help,fn,cooldown) {
    //commands['command name'] = new Command(true, 0, "", ()=>{}, 1000);
    //cooldown is optional and measured in milliseconds, defaults to 1 second

    if (typeof state !== "boolean")
        this.state = false;
    else
        this.state = state;

    if (isNaN(parseInt(minRank)) || parseInt(minRank) < 0)
        this.minRank = -1;
    else
        this.minRank = minRank;

    if (typeof fn !== "function")
        this.fn = ()=>{error(cc.red('command has invalid fn'))};
    else
        this.fn = fn;

    if (typeof help !== "string")
        this.help = "";
    else
        this.help = help;
    
    if (typeof cooldown !== "number" || !cooldown)
        this.cooldown = 1000;
    else
        this.cooldown = cooldown;
}

Command.prototype.lastExec = 0;
Command.prototype.lastHelp = 0;
Command.prototype.exec = function(role) {if (this.state && Date.now() - this.lastExec >= this.cooldown && role >= this.minRank && this.minRank >= 0) {this.lastExec = Date.now(); this.fn.apply(null, arguments);}}
Command.prototype.getHelp = function() {if (Date.now() - this.lastHelp >= 1000) {this.lastHelp = Date.now(); return this.help;} else {return "";}}

/* RANK VALUES
*  0 user
*  1 resident dj
*  2 bouncer
*  3 manager
*  4 co-host
*  5 host
*  6 brand ambassador
*  7 plug.dj admin
*/

/*commands['command name here'] = new Command(active upon start?, minimum rank to use inclusive (see above comment for list), help string (if TRIGGER+"help" is received), functionality)*/

/*
    DON'T FORGET to define your command up at doChatCommand in order for it to work
*/

commands['8ball'] = new Command(true,0,"8ball <any text> :: Asks the Magic 8 Ball a question. Any rank.",function() {
    if (arguments.length !== 3) return;
    if (BotSettings.eightBallChoices.length > 0) {
        const q = (arguments[2].length > 175 ? arguments[2].substr(0,175) : arguments[2]);
        const ans = BotSettings.eightBallChoices;
        let sndmsg = "[@"+arguments[1]+": " + q + "] ";
        sndmsg += ans[Math.floor(Math.random() * ans.length)];
        sendMessage(sndmsg);
    }
});

commands['about'] = new Command(true,0,"about :: Displays bot's \"about\" message. Any rank.",function() {
    if (arguments.length !== 1) return;
    sendMessage("about :: " + TITLE + " v" + VER + " :: by N8te- :: https://github.com/N8teZero");
});

commands['afk'] = new Command(true,0,"afk :: Sets you as afk. Not really tho. Any rank. 2s cooldown.",function() {
    if (arguments.length !== 1) return;
        return sendMessage("/me @" + arguments[1] + " is now Away From Kitchen :kappa: ");
}, 2000);

commands['afkreset'] = new Command(true,3,"afkreset @username :: Resets a users afk time. Manager+.", function() {
    const user = getUser(arguments[2]);
    if (!~user) return sendMessage("/me [@" + arguments[1] + "] Could not find that user.");
    else if (user.id === me.id) return;
    else {
        user.lastActivity = Date.now();
        return sendMessage("/me [@" + arguments[1] + "] Reset AFK for @" + user.username + "!");
    }
});

commands['afktime'] = new Command(true,2,"afktime [@username|#userID] :: Returns the amount of time a user has been inactive. Gets your own info if no valid argument. Bouncer+.",function() {
    if (arguments.length !== 3) return;
    let sndmsg = "";
    let afk = arguments[2];
    if (!~afk) {
        sndmsg = arguments[1] + " was not found in the room.";
    } else {
        if (afk.isAFK)
            sndmsg = arguments[1] + " has been inactive for " + secsToLabelTime(Date.now() - afk.lastActivity, true) + ".";
        else
            sndmsg = arguments[1] + " is currently active.";
    }
    sendMessage(sndmsg);
});

commands['anagram'] = new Command(true,0,"anagram <7-30 character string> :: Returns an anagram of the given word(s), retrieved from www.anagramgenius.com. Any rank.",function(){
    if (arguments.length !== 3) return;
    let msg = arguments[1];
    let user = arguments[2];
    let query = msg.slice(9,msg.length);
    let uriquery = encodeURI(encodeURI(query));
    let sndmsg = "[@"+user.username+'] ';
    if (query.length < 7 || query.length > 30) {
        sndmsg += "Invalid input. Use 7-30 characters.";
        sendMessage(sndmsg.trim());
    } else {
        req.get("https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20html%20where%20url%3D'http%3A%2F%2Fwww.anagramgenius.com%2Fserver.php%3Fsource_text%3D"+uriquery+"%26vulgar%3D1'&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys", {json: true}, function(e,r,b) {
            if (e) error(cc.red(e));
            else if (b && b.query.results) {
                let result = b.query.results.body.table[1].tbody.tr[2].td.h3.span[1].content;
                if (result === undefined || result === '') return;
                else result = result.slice(1,-1);
                sndmsg += '<'+query+'> ==> '+result;
                sendMessage(sndmsg.trim());
            }
        });
    } 
});

commands['blacklist'] = new Command(true,3,"blacklist <blacklist name> <add // remove|rem> <youtube|yt|1 // soundcloud|sc|2> <video ID // track ID> :: Adds or removes songs to/from a given blacklist. Manager+.",function() {
    if (!BotSettings.allowRemoteBlacklistEdit) return;
    const username = arguments[1],
        listName = arguments[2],
        action = arguments[3],
        format = arguments[4],
        mid = arguments[5];
    let SAVE = false;
        
    if (Object.prototype.toString.apply(blacklists[listName][1]) === "[object Array]") {
        let formatString = format + ":" + mid,
            message = "";
        if (action === "add") {
            if (~arrFind(blacklists[listName][1], formatString)) {
                message = "/me @" + username + ", that item was already in the given blacklist.";
            } else {
                 return isUnavailable(parseInt(format), mid, (state)=> {
                    if (state === -1) {
                        error(cc.red("Error checking availability of song."));
                    } else if (state === 1) {
                        message = "/me @" + username +", that song is invalid or unavailable.";
                        sendMessage(message);
                    } else if (state === 0) {
                        blacklists[listName][1].push(formatString);
                        message = "/me @" + username + ": Successfully added " + formatString + " to the blacklist, " + listName + ".";
                        saveBlacklist(listName);
                        sendMessage(message);
                    } else {
                        error(cc.red("Unknown code when checking availability: " + cc.redBright(state)));
                    }
                });
            }
        } else if (action === "remove" || action === "rem") {
            let i;
            message = "/me @" + username + ", that item was not found in the given blacklist.";
            for (i = 0; i < blacklists[listName][1].length; i++) {
                if (blacklists[listName][1][i] === formatString) {
                    message = "/me @" + username + ": Successfully removed " + formatString + " from the blacklist, " + listName + ".";
                    SAVE = true;
                    blacklists[listName][1].splice(i,1);
                    break;
                }
            }
            
        }
        if (SAVE)
            saveBlacklist(listName);
        if (message !== "")
            sendMessage(message);
    }
});


commands['blacklists'] = new Command(true,0,"blacklists :: Returns list of valid blacklist names to be used with the blacklist command. Any rank.",function() {
    let i,
        bl = [],
        username = arguments[1],
        message = "";
    for (i in blacklists) {
        bl.push(i);
    }
    message = "/me [@" + username + "] Blacklists: " + bl.join(', ');
    if (message !== "")
        sendMessage(message);
});

commands['candy'] = new Command(true,0,"candy <@username> :: Give someone a random tasty candy! Any Rank.",function(){
    if (arguments[2].toLowerCase() === me.username.toLowerCase()) {
        sendMessage("/me eats a candy.");
    } else if (arguments[1].toLowerCase() === arguments[2].toLowerCase()) {
        sendMessage("/me @" + arguments[1] + ", don't be so greedy. Share the candy with somebody!");
    } else if (arguments[2] !== "") {

        const toUser = getUser(arguments[2]);
        if (!~toUser) return;
        //candy list from ureadmyname's basicBot fork
        const candies = [
            "A Bowl Of Neapolitan Ice Cream", "A Bowl Of Strawberry Ice Cream", "A Packet Of Hershey's Caramels",
            "A Bowl Of Chocolate Ice Cream", "A Bowl Of Vanilla Ice Cream", "A Hershey Almond Toffee Bar",
            "A Packet Of Sourpatch Kids", "A Reeses Peanut Butter Cup", "A Packet Of Jelly Bellys",
            "A Lindt Chocolate Bar", "A Packet Of Milk Duds", "A Dove Chocolate Bar",
            "A Packet Of Tim Tams", "A Butterfinger Bar", "A Raisinets Packet", "A Sour Punch Straw",
            "An Andes Thin Mint", "A Charleston Chew", "A Packet Of M&M's", "An Almond Joy Bar",
            "A Nutrageous Bar", "A Jollyrancher", "A Kinder Bueno", "A Milkyway Bar",
            "A Snickers Bar", "A Tootsie Roll", "A Chokito Bar", "A Gum Wrapper", "A Bounty Bar",
            "A Mounds Bar", "A Mr Goodbar", "A PayDay Bar", "A Baby Ruth", "A Heath Bar",
            "A Toblerone", "A Wonka Bar", "An Aero Bar", "A Mars Bar", "A Rolo Bar", "A Twix Bar",
            "A Twizzler", "A KitKat"
        ],
        candy = candies[Math.floor(Math.random() * candies.length)];
            sendMessage("/me @" + arguments[1] + " gave @" + toUser.username + " " + candy + "!");
    }
});

commands['catfact'] = new Command(true,0,"catfact :: Grabs a random cat fact. Any rank. 2s cooldown.",function() {
    if (arguments.length !== 1) return;
    req('http://catfacts-api.appspot.com/api/facts', function (error, response, body) {
        if(body != null) {
            let msg = "Catfact: "+JSON.parse(body).facts[0];
            sendMessage(msg);
        }
    });
}, 2000);

commands['coins'] = new Command(true,0,"coins [@username|#userID] :: Returns the user's coins. Gets your own info if no valid argument. Any rank.",function() {
    if (arguments.length !== 3) return;
    let sndmsg = "";
    if (room && seen[room.slug] && seen[room.slug][arguments[2]]) {

        let usr = seen[room.slug][arguments[2]];
        if (usr.coins == undefined) usr.coins = 0;
        sndmsg = arguments[1]+" has "+usr.coins+" coins.";

    } else {
        sndmsg = arguments[1]+" was not found.";
    }
    sendMessage(sndmsg);
});

commands['commands'] = new Command(true,0,"commands :: Returns the link containing chat commands and lists any inactive ones. Any rank.",function() {
    let sndmsg = [],
        i;
    for (i in commands) {
        if (!commands[i].state) {
            sndmsg.push(i);
        }
    }
    
    if (sndmsg === []) sndmsg = "!none!";
    else sndmsg = sndmsg.join(',');
    
    sendMessage('Default command list: https://git.io/vSKwT (inactive: ' + sndmsg + ')');
});

commands['cookie'] = new Command(true,0,"cookie <@username> :: Give someone a cookie! Any rank.",function(){
    if (arguments[2].toLowerCase() === me.username.toLowerCase()) {
        sendMessage("/me eats a cookie.");
    } else if (arguments[1].toLowerCase() === arguments[2].toLowerCase()) {
        sendMessage("/me @" + arguments[1] + ", trying to give yourself a cookie, eh? Don't be so greedy!");
    } else if (arguments[2] !== "") {

        const toUser = getUser(arguments[2]);
        if (!~toUser) return;
        //cookies list from ureadmyname's basicBot fork
        const cookies = [
            "gives you a fortune cookie. It reads \"If you move your hips, you'll get all the ladies.\"",
            "gives you a sugar cookie. What, no frosting and sprinkles? 0\/10 would not touch.",
            "gives you a fortune cookie. It reads \"Why aren't you working on any projects?\"",
            "gives you a fortune cookie. It reads \"Give that special someone a compliment\"",
            "gives you a Golden Cookie. You can't eat it because it is made of gold. Dammit.",
            "has given you a plain, dry, old cookie. It was the last one in the bag. Gross.",
            "gives you a fortune cookie. It reads \"Don't forget to eat your veggies!\"",
            "gives you an enormous cookie. Poking it gives you more cookies. Weird.",
            "gives you a chocolate chip cookie. Oh wait, those are raisins. Bleck!",
            "gives you an old cookie that was left out in the rain, it's moldy.",
            "gives you a fortune cookie. It reads \"Do you even lift?\"",
            "gives you a fortune cookie. It reads \"Take a risk!\"",
            "gives you a fortune cookie. It reads \"Go outside.\"",
            "gives you a fortune cookie. It reads \"I love you.\"",
            "gives you a fortune cookie. It reads \"m808 pls\"",
            "gives you a rainbow cookie made with love :heart:",
            "gives you an Oreo cookie with a glass of milk!",
            "has given you a soft homemade oatmeal cookie!",
            "bakes you fresh cookies, it smells amazing.",
            "has given you a chocolate chip cookie!"
        ],
        cookie = cookies[Math.floor(Math.random() * cookies.length)];
        sendMessage("/me @" + toUser.username + ", @" + arguments[1] + " " + cookie);
    }
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

commands['dclookup'] = new Command(true,2,"dclookup [@username|userID] :: Returns a user's last disconnect time and position. Use their ID if they are not present in the room. Bouncer+.", function() {
    const user = ((typeof arguments[2] === "number") ? {id: arguments[2]} : getUser(arguments[2]));
    if (!~user) return sendMessage("/me [@" + arguments[1] + "] That user was not found in the room. Try using an ID.");
    else if (disconnects[user.id]) {
        return sendMessage("/me [@" + arguments[1] + "] That user disconnected " + secsToLabelTime(Date.now() - disconnects[user.id][1], true) + " ago at position " + disconnects[user.id][0] + ".");
    } else {
        return sendMessage("/me [@" + arguments[1] + "] Could not find a previous waitlist position for that user.");
    }
});

commands['disable'] = new Command(true,3,"disable <command name> :: Disable a command. Manager+.",function(){
    const cmdname = arguments[1];
    if (commands.hasOwnProperty(cmdname) && !~arrFind(['enable', 'disable'], cmdname)) {
        if (commands[cmdname].state === false) {
            sendMessage("/me Did not disable \"" + cmdname + "\", it is already inactive.");
        } else {
            commands[cmdname].state = false;
            sendMessage("/me Disabled \"" + cmdname + "\".");
        }
    }
});

commands['enable'] = new Command(true,3,"enable <command name> :: Enable a command. Manager+.",function(){
    const cmdname = arguments[1];
    if (commands.hasOwnProperty(cmdname) && !~arrFind(['enable', 'disable'], cmdname)) {
        if (commands[cmdname].state === true) {
            sendMessage("/me Did not enable \"" + cmdname + "\", it is already active.");
        } else {
            commands[cmdname].state = true;
            sendMessage("/me Enabled \"" + cmdname + "\".");
        }
    }
});

commands['english'] = new Command(true,2,"english <@username> :: Notify a user in their language to speak English if it is required. Bouncer+.",function(){
    const id = arguments[1],
        langs = {
            "en": "",
            "bg": "Моля, говорете на английски. ",
            "bs": "Molim Vas, govorite engleski. ",
            "cs": "Prosím mluv anglicky. ",
            "da": "Vær venlig at tale engelsk. ",
            "de": "Bitte sprechen Sie Englisch. ",
            "pi": "Yarr! ",
            "es": "Por favor, hable inglés. ",
            "fi": "Voitko puhua englantia? ",
            "fr": "Parlez anglais, s'il vous plaît. ",
            "hr": "Molim Vas, govorite engleski. ",
            "hu": "Kérem, angolul beszéljen. ",
            "it": "Per favore parli in inglese. ",
            "ja": "英語で話して下さい。 ",
            "ko": "영어로 말해 주세요. ",
            "lt": "Prašom kalbėti angliškai. ",
            "lv": "Lūdzu, runājiet angliski. ",
            "ms": "Sila berbahasa Inggeris. ",
            "nl": "Kunt u alstublieft Engels spreken. ",
            "no": "Vær så snill å snakk engelsk. ",
            "pl": "Proszę mówić po angielsku. ",
            "pt": "Fale em inglês. ",
            "ru": "Пожалуйста, говорите по-английски. ",
            "sk": "Hovorte po anglicky, prosím. ",
            "sl": "Prosim govori angleško. ",
            "sr": "Молим Вас, говорите енглески. ",
            "sv": "Var vänlig och tala engelska. ",
            "th": "กรุณาพูดภาษาอังกฤษ ",
            "tr": "Lütfen İngilizce konuşun. ",
            "zh": "请讲英语。 請講英語。 "
        };
    getUserData(id, function(user) {
        if (!~user) return;
        let langMsg = langs[user.language];
        if (langMsg === undefined) langMsg = "";
        sendMessage("@" + user.username + ": " + langMsg + "Please speak english.");
    });
});

commands['fact'] = new Command(true,0,"fact :: Grabs a random fact. Any rank. 2s cooldown.",function() {
    if (arguments.length !== 1) return;
    req('http://numbersapi.com/random/trivia', function (error, response, body) {
        if (!error && response.statusCode === 200 && body != null) {
            let msg = "Random fact: "+body;
            sendMessage(msg);
        }
    });
}, 2000);

commands['fortune'] = new Command(true,0,"fortune <@username> :: Give someone a fortune! Any rank.",function(){
    //fortune list from ureadmyname's basicBot fork
    const fortunes = [
        "Whatever your goals in life, embrace it visualize it, and for it will be yours.",
        "Accept that some days you’re the pigeon, and some days you’re the statue.",
        "A member of your family will soon do something that will make you proud.",
        "A firm friendship will prove the foundation on your success in life.",
        "There is a true and sincere friendship between you and your friends.",
        "Be prepared to accept a wondrous opportunity in the days ahead!",
        "Your great attention to detail is both a blessing and a curse.",
        "You find beauty in ordinary things, do not lose this ability.",
        "When everything’s coming your way, you’re in the wrong lane.",
        "You learn from your mistakes... You will learn a lot today.",
        "Your everlasting patience will be rewarded sooner or later.",
        "If you want the rainbow, you must to put up with the rain.",
        "If your desires are not extravagant they will be granted.",
        "Pray for what you want, but work for the things you need.",
        "An alien of some sort will be appearing to you shortly.",
        "You will take a chance on something in the near future.",
        "The man on the top of the mountain did not fall there.",
        "Generosity and perfection are your everlasting goals.",
        "You will inherit some money or a small piece of land.",
        "Your ability to juggle many tasks will take you far.",
        "Fame, riches and romance are yours for the asking.",
        "A friend asks only for your time, not your money.",
        "Don't ask, don't say. Everything lies in silence.",
        "Smiling often can make you look and feel younger.",
        "A single kind word will keep one warm for years.",
        "A thrilling time is in your immediate future.",
        "Your heart is a place to draw true happiness.",
        "Be mischievous and you will not be lonesome.",
        "Sometimes you just need to lay on the floor.",
        "The greatest danger could be your stupidity.",
        "The time is alway right to do what is right.",
        "You will step on the soil of many countries.",
        "Do not mistake temptation for opportunity.",
        "Good luck is the result of good planning.",
        "You will be invited to an exciting event.",
        "You will have a very pleasant experience.",
        "A friend is a present you give yourself.",
        "A pleasant surprise is in store for you.",
        "Fortune not found? Abort, Retry, Ignore.",
        "The beginning of wisdom is to desire it.",
        "The time is right to make new friends.",
        "You're the controller of your destiny.",
        "Good things are being said about you.",
        "Now is the time to try something new.",
        "Something you lost will soon turn up.",
        "Your life will be happy and peaceful.",
        "May life throw you a pleasant curve.",
        "Everyone agrees. You are the best.",
        "Express yourself Don't hold back!",
        "Happiness comes from a good life.",
        "You will live a long, happy life.",
        "Do not fear what you don't know.",
        "Happy news is on its way to you.",
        "You will receive a fortune."
    ],
    fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    if (arguments[2].toLowerCase() === me.username.toLowerCase() || arguments[1].toLowerCase() === arguments[2].toLowerCase()) {
        sendMessage("/me @"+arguments[1]+", Miss Cleo is reading your fortune, it says '"+fortune+"'");
    } else if (arguments[2] !== "") {
        const toUser = getUser(arguments[2]);
        if (!~toUser) return;
        sendMessage("/me @"+toUser.username+", Miss Cleo is reading your fortune, it says '"+fortune+"'");
    }
});

commands['gif'] = new Command(true,0,"gif <tags> :: Grabs a random image from Giphy with the given tags. Any rank. 2s cooldown.",function() {
    if (arguments.length !== 3) return;
    let username = arguments[1];
    let spl = arguments[2];
    let params = {
        key: "dc6zaTOxFJmzC",
        tags: spl.join("+"),
        rating: "r"
    };
    let url = "https://api.giphy.com/v1/gifs/random?api_key=" + params.key + "&tag=" + params.tags + "&rating=" + params.rating;
    req.get(url, {json: true}, function(e,r,b) {
        if (e) error(cc.red(e));
        else if (b && b.meta && b.meta.status === 200 && b.data && b.data.hasOwnProperty('id')) {
            req.get("http://api.giphy.com/v1/gifs/" + b.data.id + "?api_key=" + params.key, {json: true}, function(e,r,b) {
                if (e) error(cc.red(e));
                else if (b && b.meta && b.meta.status === 200 && b.data && b.data.images) {
                    let image = "",
                        imageList = [
                            b.data.images.original,
                            b.data.images.downsized_large,
                            b.data.images.downsized
                        ],
                        i;
                    for (i in imageList) {
                        if (parseInt(imageList[i].size) <= 4194304) {
                            image = imageList[i].url.split('http://').join('https://');
                            break;
                        }
                    }
                    if (image && image !== "") {
                        sendMessage("/me [@" + username + "] [Tags: " + spl.join(", ") + "] " + image);
                    }
                }
            });
        }
    });
}, 2000);

commands['jointime'] = new Command(true,2,"jointime [@username|#userID] :: Returns amount of time since the given user entered the room. Gets your own info if no valid argument. Bouncer+.",function() {
    if (arguments.length !== 3) return;
    let sndmsg = "";
    if (room && seen[room.slug] && seen[room.slug][arguments[2]] && seen[room.slug][arguments[2]]['lastWelcome'] && ~getUser(arguments[2])) {
        let usr = seen[room.slug][arguments[2]];
        sndmsg = arguments[1]+" joined approximately "+secsToLabelTime(Date.now() - usr.lastWelcome, true)+" ago.";
    } else {
        sndmsg = arguments[1]+" was not found.";
    }
    sendMessage(sndmsg);
});

commands['justdoit'] = new Command(true,0,"justdoit|jdi [@username] :: Inspirational gif for a user! Any rank.",function() {
    if (arguments.length !== 3) return;

    const jdis = [
        "104ueR8J1OPM2s", "87xihBthJ1DkA", "3o7TKPVo3SMEMMwISY", "l0HluZItcJ8oIWb5K", "l0HlxYwrPoJHv1Smc", "3o7TKsXnnK5W5RELQY", "L8j8ItHbumPO8"
    ],
    jdi = jdis[Math.floor(Math.random() * jdis.length)];
    const user = getUser(arguments[2]);
    if (!~user) return sendMessage("/me [@" + arguments[1] + "] Could not find that user.");
    else{
        return sendMessage("/me [@" + user.username + "] https://media.giphy.com/media/"+jdi+"/giphy.gif");
    }
});

commands['kick'] = new Command(true,3,"kick @username :: Bans a user from the room and unbans them 2.5 seconds later, simulating a kick. Manager+.", function() {
    const user = getUser(arguments[2]);
    if (!~user) return sendMessage("/me [@" + arguments[1] + "] Could not find that user.");
    else if (user.id === me.id) return;
    else {
        kickUser(user.id, 1);
        return sendMessage("/me [@" + arguments[1] + "] Kicking user @" + user.username + "...");
    }
});

commands['link'] = new Command(true,1,"link :: Returns the link of the song currently playing. RDJ+.",function() {
    if (arguments.length !== 1) return;
    outputCurrentLink(true);
});

commands['pelt'] = new Command(true,0,"pelt|throw [@username] :: Throws a random object at a user! Any rank. 4s cooldown",function() {
    let pTarget = "";
    if (arguments[2].toLowerCase() === me.username.toLowerCase()) {
        pTarget = "no one";
    } else if (arguments[1].toLowerCase() === arguments[2].toLowerCase()) {
        pTarget = "themselves";
    } else if (arguments[2] !== "") {
        pTarget = getUser(arguments[2]);
        if (!~pTarget) return;
        pTarget = "@" + pTarget.username;
    }
        const quantityarr = [
            "some", "several", "Ten Thousand", "26", "a few", "a lot of", "scores of", "countless", "a myriad of", "7", "a plethora of", "4", "a bazillion",
            "loads of", "numerous", "62", "12", "an immeasurable amount of", "58", "11", "17", "an overabundance of", "a profuse amount of", "9", "101"
        ]
        const objectarr = [
             "plates", "fence posts", "stools", "chairs", "keyboards", "rocks", "sticks", "cds", "tvs", "cookies", "brownies", "chairs", "fruits", "trees", "dice",
             "telephones", "glasses", "garbage bags", "briefcases of money", "$100.00 bills", "hot babes", "thongs", "bikinis", "pies", "oranges", "grapes", "burgers",
             "packets of ketchup", "bottles of mustard", "hotdog buns", "toilet paper rolls", "barrels", "pizzas", "packets of soy sauce", "newborn infants", "batteries",
             "toilets", "mice", "rats", "water-balloons", "binders", "balls of paper", "filing cabinets", "tacos", "burritos", "pizza boxes", "sacks of corn", "printers",
             "ak47s", "bottles of beer", "bottles of rum", "bottles of booze", "dishes", "cups", "hand guns", "pistols", "steering wheels", "bikes", "cars", "bike wheels",
             "car tires", "desert eagles", "pens", "pop cans", "Pepsi's", "Coke's", "salads", "bottles of salad dressing", "bottles of mayonnaise", "tubs of margarine",
             "balloons", "scoops of cat litter", "cans of cat food", "bags of dog food", "banana peels", "tables", "snowballs", "yellow snowballs", "red snowballs",
             "juice boxes", "empty containers", "broken chairs", "shaved donkeys", "water bottles", "eye glasses", "hotdogs", "hamburger buns", "hotdog buns", "chickens",
             "cats", "dogs", "pigs", "horses", "elephants", "tigers", "cheetahs", "birds", "fish", "apes", "chimps", "cacti", "salt"
        ]
        const typearr = [
            "Hurls", "Catapults", "Casts", "Chucks", "Lobs", "Throws", "Volleys", "Tosses", "Pelts", "Heaves", "Pitches", "Fires", "Flicks", "Flings", "Launches", "Shoots", "Propels"
        ]
        let object = objectarr[Math.floor(Math.random() * objectarr.length)];
        let qty = quantityarr[Math.floor(Math.random() * quantityarr.length)];
        let throwtype = typearr[Math.floor(Math.random() * typearr.length)];
        sendMessage("/me @" + arguments[1] + " " + throwtype + " " + qty + " " + object + " at " + pTarget + "!");
}, 4000);

commands['props'] = new Command(true,0,"props :: Show some appreciation for the DJ! Any rank.",function(){
    const dj = getUser(room.booth.currentDJ);
    if (!room || !~dj || (~dj && arguments[1] === dj.username)) return;
    //props list from ureadmyname's basicBot fork
    const props = [
        "it's lit fam", "this song = 11/10 IGN", "this track is amazing",
        "awesometastic play", "love this song <3", "this is top shit",
        "excellent tune", "awesome track", "amazing song", "just amazing",
        "great song", "nice play", "killer", "yo, this is some dope shit"
    ],
    prop = props[Math.floor(Math.random() * props.length)];
    sendMessage("/me @" + arguments[1] + " gave props to @" + dj.username + ", \"" + prop + "!\"");
});

commands['roll'] = new Command(true,0,"roll :: Returns a random number between 1 - 100. Any rank.",function(){
    if (arguments.length !== 1) return;
    let roll = Math.floor(Math.random() * 100);
    if(roll === 0) { roll = 1;}
    sendMessage("\/me [@"+arguments[1]+"] You rolled a "+roll+" :game_die:");
});

commands['seentime'] = new Command(true,2,"seentime [@username|#userID] :: Returns the total amount of time a user has been seen in the room. Gets your own info if no valid argument. Bouncer+.",function() {
    if (arguments.length !== 3) return;
    let sndmsg = "";
    if (room && seen[room.slug] && seen[room.slug][arguments[2]]) {
        activeCheck(arguments[2]);
        let since = ".";
        if (seen[room.slug][arguments[2]]['firstSeen']) since = " since " + new Date(seen[room.slug][arguments[2]].firstSeen).toDateString().substr(4) + ".";
        sndmsg = arguments[1]+" has been in this room for approximately "+secsToLabelTime(seen[room.slug][arguments[2]].activeTime, true)+since;
    } else {
        sndmsg = arguments[1]+" was not found.";
    }
    sendMessage(sndmsg);
});

commands['set'] = new Command(true,3,"set <option> <value> :: Sets a bot option to the given value. If no value is given, returns the current value of it. List of valid options: Manager+.",function(){
    const username = arguments[1],
        option = arguments[2].toLowerCase(),
        valid = {
            'autowoot':BotSettings.autoWoot,
            'welcomeusers':BotSettings.welcomeUsers,
            'chatdeletetriggermessages':BotSettings.chatDeleteTriggerMessages,
            'chatdeleteresponses':BotSettings.chatDeleteResponses,
            'announcementinterval':BotSettings.announcementInterval,
            'announcementrandom':BotSettings.announcementRandom,
            'sendannouncements':BotSettings.sendAnnouncements,
            'usemessagecommands':BotSettings.useMessageCommands,
            'doafkcheck':BotSettings.doAFKCheck,
            'doautodisable':BotSettings.doAutoDisable,
            'autostuckskip':BotSettings.autoStuckSkip,
            'doskipcheck':BotSettings.doSkipCheck,
            'doautoskip':BotSettings.doAutoSkip,
            'hostbypassautoskip':BotSettings.hostBypassAutoSkip,
            'sendmotd':BotSettings.sendMOTD,
            'motdinterval':BotSettings.motdInterval,
            'motd':BotSettings.motd,
            'cleverbot':BotSettings.cleverbot,
            'lottointerval':BotSettings.lottoInterval,
            'lotto':BotSettings.doLotto,
            'maxlength':BotSettings.maxlength
        };
        
    let val = arguments[3];
    let message = "";
    if (!valid.hasOwnProperty(option)) message = "That option is either invalid or was not found.";
    else {
        let i;
        const getName = function() {
            for (i in BotSettings) {
                if (i.toLowerCase() === option)
                    return i;
            }
            return "(NOT FOUND)";
        }
        if (val === null) {
            message = getName() + " is currently set to: " + valid[option];
        } else {
            if (val === "true" || val === "on") val = true;
            else if (val === "false" || val === "off") val = false;
            else if (strIsNum(val)) val = parseInt(val);
            
            if (typeof val === typeof valid[option]) {
                if (BotSettings[getName()] === val) message = getName() + " is already set to " + val + ".";
                else if (typeof val === "number") {
                    if ((option === "announcementinterval" || option === "motdinterval" || option === "lottointerval" || option === "maxlength") && val < 5000)
                        message = "That is an invalid interval amount. Must be 5000+.";
                    else
                        BotSettings._fn.changeSetting(option, val);
                        message = "Changed " + getName() + " to: " + val;
                } else {
                    BotSettings._fn.changeSetting(option, val);
                    message = "Changed " + getName() + " to: " + val;
                }
            }
        }
    }
    if (message !== "")
        sendMessage("/me [@" + username + "] " + message);
});

commands['shots'] = new Command(true,0,"shots|shot [@username] :: Buy a random shot for a user! Any rank.",function() {
    if (arguments[2].toLowerCase() === me.username.toLowerCase()) {
        sendMessage("/me takes a shot.");
    } else if (arguments[1].toLowerCase() === arguments[2].toLowerCase()) {
        sendMessage("/me @" + arguments[1] + ", buy someone else a shot for once.");
    } else if (arguments[2] !== "") {
        const toUser = getUser(arguments[2]);
        if (!~toUser) return;
        //shots list from ureadmyname's basicBot fork
        const shots = [
            "Slippery Nipple", "Tequila Slammer", "Irish Car Bomb",
            "Liquid Cocaine", "Redheaded Slut", "Johnny Walker",
            "Cement Mixer", "Jack Daniels", "Grasshopper",
            "Jell-O-Shot", "Sammy Jager", "Black Rose",
            "Jager Bomb", "Lemon Drop", "Melon Ball",
            "Fireball", "Jim Beam", "Kamikaze",
            "Smirnoff", "Tequila", "B-52",
            "Hot Damn", "Pineapple Upside Down Cake", "White Gummy Bear",
            "Absolut Bitch", "Absolut Legspreader", "Alice in Wonderland",
            "Jolly Rancher", "Buttery Nipple", "252",
            "Captain Coke", "Panty Man", "Kick in the balls",
            "Mind Eraser", "Motor Oil", "Afterburner",
            "Partybar Schuffel", "Jack Daniels", "Tes Generaciones",
            "Passed Out Naked in the Bathroom", "A Kick in the Crotch", "Flaming Lemon Drop",
            "Purple Hooter", "Cherry Tootsie Pops", "Blow Job",
            "Scooby Snack", "Surfer on Acid", "Alabama Slammer",
            "Ohio State Redeye", "Washington Apple", "Cherry Bomb", "Three Wise Men",
            "Crown Royal", "Hennessy"
        ],
        shot = shots[Math.floor(Math.random() * shots.length)];
        sendMessage("/me @" + arguments[1] + " bought @" + toUser.username + " a shot of " + shot + "!");
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

commands['skipreasons'] = new Command(true,2,"skipreasons :: Lists reasons that can be used with " + TRIGGER + "skip. Bouncer+.", function() {
    if (arguments.length !== 2) return;
    let reasons = BotSettings.skipReasons;
    let sndmsg = "[@" + arguments[1] + "] Skip reasons: ";
    if (typeof reasons !== "object" || Object.keys(reasons).length < 1) sndmsg += "(none found)";
    else {
        let temp = [],
            i;
        for (i in reasons) {
            temp.push(i);
        }
        temp = temp.join(", ");
        sndmsg += temp;
    }
    sendMessage(sndmsg);
});

commands['stats'] = new Command(true,0,"stats [@username|#userID] :: Returns the user's recorded amount of plays and votes received. Gets your own info if no valid argument. Bouncer+.",function() {
    if (arguments.length !== 3) return;
    let sndmsg = "";
    if (room && seen[room.slug] && seen[room.slug][arguments[2]]) {
        let usr = seen[room.slug][arguments[2]];
        if (usr.lotto == undefined) usr.lotto = 0;
        if (usr.coins == undefined) usr.coins = 0;
        if (usr.plays >= 1) {
            sndmsg = arguments[1]+"'s overall stats: Plays:"+usr.plays+", W:"+usr.votes.woot+", G:"+usr.votes.grab+", M:"+usr.votes.meh+", Lotto Wins:"+usr.lotto+", Coins:"+usr.coins+"";
        } else {
            sndmsg = arguments[1]+" has no stats yet.";
        }
    } else {
        sndmsg = arguments[1]+" was not found.";
    }
    sendMessage(sndmsg);
});

commands['status'] = new Command(true,0,"status :: Returns settings status of the bot. Any rank.",function() {
    if (STARTTIME) {
        let uptime = secsToLabelTime(Date.now() - STARTTIME, true);
        let mem = Math.ceil(MEMORY.heapUsed / 1024) + 'K';
        let heart = secsToLabelTime(Date.now() - HEARTBEAT.last, true);
        let sndmsg = "/me "+TITLE+" v"+VER+" | Uptime: "+uptime+" | Memory: "+mem+" | Heartbeat: "+heart+"";
        sendMessage(sndmsg);
    }
});

commands['swap'] = new Command(true,3,"swap @user1 @user2 :: Swaps positions of two users in the waitlist. At least one must be in the waitlist. Manager+.", function () {
    if (arguments.length !== 2) return;
    const message = arguments[1],
        atx = message.indexOf('@'),
        aty = message.indexOf('@', atx + 1);
    
    if ((room && room.booth.isLocked) || atx < 0 || aty < 0 || atx === aty) {
        return;  
    } else {
        const userx = getUser(message.slice(atx+1,aty-1)),
              usery = getUser(message.slice(aty+1));
        if (~userx && ~usery) {
            const posx = getWaitlistPos(userx.id),
                  posy = getWaitlistPos(usery.id);
            if (posx < 0 && posy < 0) {
                return;   
            } else if (posx >= 0 && posy >= 0) {
                moveDJ(userx.id, posy, function() {
                    moveDJ(usery.id, posx); 
                });
            } else if (posx < 0 && posy >= 0) {
                removeUserFromWaitlist(usery.id, function() {
                    addUserToWaitlist(userx.id, function() {
                        moveDJ(userx.id, posy);
                    });
                });
            } else if (posy < 0 && posx >= 0) {
                removeUserFromWaitlist(userx.id, function() {
                    addUserToWaitlist(usery.id, function() {
                        moveDJ(usery.id, posx);
                    });
                });
            } else {
                return;   
            }
        }
    }
});

commands['trigger'] = new Command(true,0,"trigger :: Returns current trigger of the bot. This can be called with any valid trigger character. Any rank.",function() {
    validateTrigger();

    sendMessage('Current command trigger: '+TRIGGER);
});

commands['uptime'] = new Command(true,0,"uptime :: Returns uptime of this bot. Any rank.",function() {
    if (STARTTIME) {
        let uptime = secsToLabelTime(Date.now() - STARTTIME, true);
        let sndmsg = "Bot uptime: " + uptime;
        sendMessage(sndmsg);
    }
});

commands['weed'] = new Command(true,0,"weed <@user> :: Passes some dankness to a user. Any rank.",function() {
    if (arguments[2].toLowerCase() === me.username.toLowerCase()) {
        sendMessage("/me takes a hit.");
    } else if (arguments[1].toLowerCase() === arguments[2].toLowerCase()) {
        sendMessage("/me @" + arguments[1] + ", pass the weed!");
    } else if (arguments[2] !== "") {
        const toUser = getUser(arguments[2]);
        if (!~toUser) return;
        const weeds = [
            "a Loaded Bong", "a Lit Joint", "a Fat Blunt",
            "a Special Brownie", "a Keef Bowl", "a Dab Rig",
            "a Candy Edible", "a Loaded Pipe", "Some Sour Diesel",
            "Some Girl Scout Cookies", "Some OG Kush",
            "Some Jack Herer", "Some Granddaddy Purp",
            "Some Khalifa Kush", "Some Lemon Haze",
            "Some Northern Lights"
        ],
        weed = weeds[Math.floor(Math.random() * weeds.length)];
        sendMessage("/me @" + arguments[1] + " passes @" + toUser.username + " " + weed + "!");
    }
});

//only call this when logged out!
//don't forget to close the websocket too
//does not work correctly yet
function cleanState() {
    validateTrigger();
    HIGHWAY = 21;
    LASTSENTMSG = 0;
    if (room) room.lotto._cleanup();
    sessJar = me = {};
    clearInterval(SAVESEENTIME);
    clearInterval(AFKCHECKTIME);
    clearInterval(AUTODISABLETIME);
    clearTimeout(ANNOUNCEMENTTIME);
    clearTimeout(HEARTBEAT.timer);
    clearTimeout(MOTDTIME);
    room = null;
    rl.close();
}

//http://stackoverflow.com/questions/12672193/fixed-position-command-prompt-in-node-js
//write() is adapted from Hors Sujet's answer in the above link
function write(args) {
    let t = Math.ceil((rl.line.length + 3) / process.stdout.columns);
    let text = util.format.apply(console, args);
    process.stdout.write("\n\x1B[" + t + "A\x1B[0J");
    process.stdout.write(text+'\n');
    process.stdout.write("\n\x1B[E".repeat(t - 1));
    rl._refreshLine();
}

clearWindow();

console.log(cc.bgWhiteBright(' '.repeat(process.stdout.columns-1)));
console.log(cc.bgWhite(' '.repeat(process.stdout.columns-1)));
console.log(cc.bgBlackBright(' '.repeat(process.stdout.columns-1)));
console.log('\n');
console.log(cc.magentaBright(TITLE + ' v' + VER));
console.log(cc.blackBright('https://github.com/'+cc.blueBright("N8teZero")));
console.log(cc.blackBright('https://plug.dj/@/'+cc.blueBright("N8te420")));

console.log = function() { write(arguments); }

function log(msg) { console.log(timestamp() + msg); }
function nodeLog(msg) { console.log(timestamp() + cc.black.bgGreenBright(' Node ') + ' '.repeat(HIGHWAY-6) + msg); }
function error(msg) { console.log(timestamp() + cc.black.bgRedBright(' ERR  ') + ' '.repeat(HIGHWAY-6) + msg); }
function warn(msg) { console.log(timestamp() + cc.black.bgYellowBright(' WARN ') + ' '.repeat(HIGHWAY-6) + msg); }
function info(msg) { console.log(timestamp() + cc.black.bgBlueBright(' Info ') + ' '.repeat(HIGHWAY-6) + msg); }
function debug(msg) { if (DEBUG) console.log(timestamp() + cc.black.bgMagentaBright(' DEBUG ') + ' '.repeat(HIGHWAY-7) + msg); }

if (EXTERNALSETTINGS)
    BotSettings._fn.loadFromFile();
else
    BotSettings._fn.apply();

fs.readFile('data/seenUsers.json', (e,data)=>{if (e) return; else if (data && data+"" !== "") {seen = JSON.parse(data+""); startTimer("seen");}});

login();