# Swiftify
An easy-to-use Discord bot I made to monitor server uptime and send a notification to a channel when a server is unavailable or backed up.

## Installation

**Requirements:**
- NodeJS 16+
- NPM 8+
- Git, and PM2 if needed

```
git clone https://github.com/adreaisbad/Swiftify
cd Swiftify
npm install

npm run start
```

## Configuration

Edit ```settings.example.yml```, replace all the default values if needed.

At this time, running the bot doesn't require any privileged intents. 

## Usage

> Only **ping** method is supported for now; further methods will be added later. 

Start keeping an eye on your server by doing ```/add``` command and entering all the necessary information.
 
Webhooks are used to send notifications, so if you haven't created one yet, do so and replace it in the configuration file. 

## Contributing

### Bug Reports & Features Request

Create an issue on GitHub. Provide a brief explanation of the requested features along with an example of how they would operate. 

### License

The MIT license is used to manage this repository. 
