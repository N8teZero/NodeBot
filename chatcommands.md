# Default Commands
---------
Use these commands in chat by using the bot's trigger (! by default) followed by the command name. Some commands require arguments. If any parameters for a command are surrounded in square brackets below, those parameters are optional.

## Users
|Command Name|Arguments|Description|
|:----------:|---------|-----------|
|8ball       |`<any text>` | Asks the Magic 8 Ball a question.
|afk         |         | Sets you as AFK. Not really tho.
|about       |         | Displays bot's "about" message.
|anagram     |`<7-30 character string>` | Returns an anagram of the given word(s), retrieved from www.anagramgenius.com.
|blacklists  |         | Returns list of valid blacklist names to be used with the blacklist command.
|commands    |         | Lists active commands and amount of inactive commands.
|candy       |`<@username>` | Give someone a random tasty candy!
|catfact     |         | Returns a random Cat fact.
|coins       |`[@username]` | Displays your current coins. Bouncer+ can lookup other users coins.
|cookie      |`<@username>` | Give someone a cookie!
|dc          |         | Places you back into the waitlist at your old position ONLY IF you were disconnected while waiting.Must be undefined since disconnecting.
|fact        |         | Returns a random numerical fact.
|flip        |         | Flips a coin.
|fortune     |`[@username]` | Miss Cleo will read out a fortune! Gets your own fortune if no valid argument.
|gif         |`<tags>`| Grabs a random image from Giphy with the given tags. 2s cooldown.
|help        |`<chat command name>`| Returns the description of a command.
|justdoit    |`[@username]` | Sends an inspirational gif to the user.
|pelt        |`[@username]` | Throws a random object at a user Also accepts punish or throw. 
|props       |         | Show some appreciation for the DJ!
|roll        |[`<#>]` | Returns a random number up 100.
|roomscore   |         | Returns the current Room Score.
|rps         |`<choice>` | Play Rock Paper Scissors Lizard Spock with the bot.
|shot        |`[@username]` | Buy a random shot for a user!
|trigger     |         | Returns current trigger of the bot. This can be called with any valid trigger character.
|uptime      |         | Returns uptime of this bot.
|weed        |`<@username>` | Give someone some weed!

## RDJ
|Command Name|Arguments|Description|
|:----------:|---------|-----------|
|link        | | Returns the link of the song currently playing.

## Bouncers
|Command Name|Arguments|Description|
|:----------:|---------|-----------|
|afktime     |`[@username//#userID]` | Returns the amount of time a user has been inactive. Gets your own info if no valid argument.
|dclookup    |`[@username//userID]` | Returns a user's last disconnect time and position. Use their ID if they are not present in the room.
|english     |`<@username>` | Notify a user in their language to speak English if it is required.
|jointime    |`[@username//#userID]` | Returns amount of time since the given user entered the room. Gets your own info if no valid argument.
|seentime    |`[@username//#userID]` | Returns the total amount of time a user has been seen in the room. Gets your own info if no valid argument.
|skip        |`[reason]` | Skips current song with optional reason, if valid.
|skipreasons |         | Lists reasons that can be used with !skip.
|stats       |`[@username//#userID]` | Returns the user's recorded amount of plays and votes received. Gets your own info if no valid argument.
|status      |         | Views teh bot uptime, version, and hearbeat.
|swap        |`@user1` `@user2` | Swaps positions of two users in the waitlist. At least one must be in the waitlist.

## Managers
|Command Name|Arguments|Description|
|:----------:|---------|-----------|
|afkreset    |`@username`| Resets the AFK time for a user.
|bonus       |`coin #` | Rewards everyone in the room with # coins. Don't use a lot plz.
|blacklist   |`<blacklist name>` `<add, remove//rem>` `<youtube//yt//1, soundcloud//sc//2>` `<video ID//track ID>` | Adds or removes songs to/from a given blacklist.
|disable     |`<command name>` | Disable a command.
|enable      |`<command name>` | Enable a command.
|kick        |`@username`| Bans a user from the room and unbans them 2.5 seconds later, simulating a kick.
|set         |`<option>` `<value>` | Sets a bot option to the given value. If no value is given, returns the current value of it. [Valid options.](setoptions.md)
|startlotto  |         | Force starts the lotto.

## Hosts
|Command Name|Arguments|Description|
|:----------:|---------|-----------|
|kill        |         | Kills the bot session.

# Custom Commands
---------
These are the custom commands. Available for all users.

|Command Name|Description|
|:----------:|-----------|
|owner       | Ping the owner of RoboTHC.
|subinfo     | Provides info about Plug Subscription.
|rcs         | Links our recommended Plug Extension.
|fav         | Reminder to favorite the room.
|emoji       | Links an emoji reference page.
|discord     | Provides invite link to Discord server.
|dcinfo      | Information about the DC command.
|lottoinfo   | Information about the DJ lottery.
|ba          | Information about Brand Ambassadors
|android     | Links to the plug android app.
|ios         | Links to the plug ios app.
|changelog   | Links to the bot's changelog.


# Coming Soon
---------
These are the commands and features that are planned

|Command Name|Arguments|Description|
|:----------:|---------|-----------|
|cc          | `<command>` `<response>` | Create custom command
|gamble      | `<points>` | Gambles X amount of money in some sort of game.
|money       | `[pay]` `[@user]` | Either views your current money or pays another user.
|top         |`[coins//lotto]` | View the top 5 coins or lotto users.
|movedown    || Moves you down a place to give you more time.
|online      || Display who is in the room for mobile users.
|lottoeta    || Display a counter for next lotto session.
