const express = require('express')
const { WebhookClient } = require('dialogflow-fulfillment')
const app = express()
const fetch = require('node-fetch')
const base64 = require('base-64')
const pluralize = require('pluralize')

let username = "";
let password = "";
let token = "";

async function getData(endpoint) {
  let request = {
    method: 'GET',
    headers: {'Content-Type': 'application/json'},
    redirect: 'follow'
  }

  try {
    const serverReturn = await fetch('http://127.0.0.1:5000'+endpoint,request)
    const serverResponse = await serverReturn.json()

    return [serverReturn.status,serverResponse];
  } catch(e) {
    console.log(e);
    return [null, e]
  }

}

async function postData(endpoint) {
  let request = {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    redirect: 'follow'
  }
  try {
    const serverReturn = await fetch('http://127.0.0.1:5000'+endpoint,request)
    const serverResponse = await serverReturn.json()
    return [serverReturn.status,serverResponse];
  } catch(e) {
    console.log(e);
    return [null, e]
  }

}

function notEmpty(object) {
  return object !== undefined && object !== null && object !== ''
}

function objectToString(object,includeLocation) {
  includeLocation = includeLocation || false;
  if (includeLocation) {
    if (object.location == 'box') {
      return `${object.color} ${object.type} in the ${object.location}`
    } else {
      return `${object.color} ${object.type} on the ${object.location}`
    }
  } else {
    return `${object.color} ${object.type}`
  }
}

function findObject(type,color,location,objectList){
  let filterByType = notEmpty(type);
  let filterByColor = notEmpty(color);
  let filterByLocation = notEmpty(location);
  if (filterByType && filterByColor && filterByLocation) {
    return objectList.filter((object)=>(object.type === type && object.color === color && object.location === location));
  } else if (filterByType && filterByColor) {
    return objectList.filter((object)=>(object.type === type && object.color === color));
  } else if (filterByType && filterByLocation) {
    return objectList.filter((object)=>(object.type === type && object.location === location));
  } else if (filterByColor && filterByLocation) {
    return objectList.filter((object)=>(object.color === color && object.location === location));
  } else if (filterByType) {
    return objectList.filter((object)=>(object.type === type));
  } else if (filterByColor) {
    return objectList.filter((object)=>(object.color === color));
  } else if (filterByLocation) {
    return objectList.filter((object)=>(object.location === location));
  } else {
    return objectList.filter((object)=>(true));
  }
}

function stringArrayToWords(array) {
  let string = '';
  array.forEach((word,index) => {
    if (index === array.length -1) {
      string += `and ${word}`
    } else {
      string += `${word}, `
    }
  })
  return string;
}

app.get('/', (req, res) => res.send('online'))
app.post('/', express.json(), (req, res) => {
  const agent = new WebhookClient({ request: req, response: res })

  function welcomeIntent() {
    console.log('welcomeIntent')
    agent.add('Hi, I am your Robot Assistant!')
  }

  async function handleMove(objectId,locationGoal) {
    let response = await postData(`/locations/${locationGoal}/objects/${objectId}`);
    if (response[0] !== 200) {
      agent.add(`I'm very sorry, but I am having some problems moving objects. Can you please try again?`);
    } else {
      agent.context.delete('current-object');
      agent.context.delete('current-location');
      agent.context.delete('current-objective');
      agent.add(`${response[1].message}`) // Server returns a nice message.

    }
  }

  async function focusLocationIntent() {
    console.log('focusLocationIntent');
    let location = agent.parameters.location;
    if (!(notEmpty(location))) {
      agent.add(`I'm not sure which location you're referring to. Could you be more specific?`);
      return;
    }
    // Get the list of locations and check that the location is valid
    let response = await getData('/locations/');
    if (response[0] !== 200) {
      agent.add(`I'm very sorry, but I am having some problems checking the scene. Can you please try again?`);
      return
    }
    let locations = response[1].locations;
    if (locations.indexOf(location) === -1) {
      agent.add(`I'm not familiar with the ${location}. I only know about the ${stringArrayToWords(locations)}.`);
      return
    }

    // Set the location context to that location.
    agent.context.set({'name':'current-location',
                       'lifespan':5,
                       'parameters':{'name':location}});
     objective = agent.context.get('current-objective') || {parameters:{}};
     object = agent.context.get('current-object') || {parameters:{}};
     if (objective.parameters.goal === 'moveObject' && notEmpty(object.parameters.id)) {
       await handleMove(object.parameters.id,location);
     } else if (objective.parameters.goal === 'moveObject') {
       agent.add(`Alright. I'll move something to the ${objectToString(matched[0])}. Which object did you want me to move?`)
     } else {
       agent.add(`Alright. I'll focus on the ${location}`);
     }
  }

  async function focusObjectIntent() {
    console.log('focusObjectIntent')
    contextObject = agent.context.get('current-object') || {parameters: {}};
    let objectType = notEmpty(agent.parameters.object) ? agent.parameters.object : contextObject.parameters.type;
    let objectColor = notEmpty(agent.parameters.color) ? agent.parameters.color : contextObject.parameters.color;

    // Get the list of objects and check that the object is valid
    response = await getData('/objects/')
    if (response[0] !== 200) {
      agent.add(`I'm very sorry, but I am having some problems checking the scene. Can you please try again?`);
      return
    }
    allObjects = response[1].objects;
    matched = findObject(objectType, objectColor, null, allObjects);
    if (matched.length == 0) {
      agent.add(`I'm not familiar with that object. I only know about the ${stringArrayToWords(allObjects.map((object)=>objectToString(object,false)))}.`);
      return;
    } else if (matched.length > 1) {
      agent.add(`It looks like there is a ${stringArrayToWords(matched.map((object)=>objectToString(object,true)))}. Which one did you mean?`);
      return
    }

    // Set the location context to that location.
    agent.context.set({'name':'current-object',
                       'lifespan':5,
                       'parameters':matched[0]})

    objective = agent.context.get('current-objective') || {parameters:{}};
    location = agent.context.get('current-location') || {parameters:{}};
    if (objective.parameters.goal === 'moveObject' && notEmpty(location.parameters.name)) {
      await handleMove(matched[0].id,location.parameters.name);
    } else if (objective.parameters.goal === 'moveObject') {
      agent.add(`Alright. I'll move the ${objectToString(matched[0])}. Which location did you want me to move it to?`)
    } else {
      agent.add(`Alright. I'll focus on the ${objectToString(matched[0])}`)
    }
  }

  function clearFocusIntent() {
    console.log('moveObjectRequestIntent')
    // Clear the contexts
    agent.context.delete('current-object');
    agent.context.delete('current-location');
    agent.context.delete('current-objective');
    agent.add('Sounds good!')
  }

  async function objectLocationQueryIntent() {
    console.log('objectLocationQueryIntent')
    // Where is the ...?
    contextObject = agent.context.get('current-object') || {parameters:{}};
    contextLocation = agent.context.get('current-location') || {parameters:{}};
    let objectType = agent.parameters.object || contextObject.parameters.type;
    let objectColor = agent.parameters.color || contextObject.parameters.color;
    let objectLocation = agent.parameters.location || contextLocation.parameters.name;
    // Get the list of objects and check that the object is valid
    response = await getData('/objects/');
    if (response[0] !== 200) {
      agent.add(`I'm very sorry, but I am having some problems checking the scene. Can you please try again?`);
      return
    }
    allObjects = response[1].objects;
    matched = findObject(objectType, objectColor, objectLocation, allObjects);
    if (matched.length == 0) {
      agent.add(`I'm not familiar with the ${location}. I only know about the ${stringArrayToWords(allObjects.map((object)=>objectToString(object,false)))}.`);
      return;
    } else if (matched.length > 1) {
      agent.add(`It looks like there is a ${stringArrayToWords(matched.map((object)=>(objectToString(object,true))))}. Which one did you mean?`);
      return
    }

    // Set the object context to that location.
    agent.context.set({'name':'current-object',
                       'lifespan':5,
                       'parameters':matched[0]})
    agent.add(`The ${objectToString(matched[0],false)} is ${matched[0].location === 'box' ? 'in' : 'on'} the ${matched[0].location}`)
  }

  async function locationObjectQueryIntent() {
    console.log('locationObjectQueryIntent')
    // What's all at the ...?

    let location = agent.parameters.location;
    if (!(notEmpty(location))) {
      agent.add(`I'm not sure which location you're referring to. Could you be more specific?`);
      return;
    }
    // Get the list of locations and check that the location is valid
    let locResponse = await getData('/locations/');
    if (locResponse[0] !== 200) {
      agent.add(`I'm very sorry, but I am having some problems checking the scene. Can you please try again?`);
      return
    }
    let locations = locResponse[1].locations;
    if (locations.indexOf(location) === -1) {
      agent.add(`I'm not familiar with the ${location}. I only know about the ${stringArrayToWords(locations)}.`);
      return
    }

    // Set the location context to that location.
    agent.context.set({'name':'current-location',
                       'lifespan':5,
                       'parameters':{'name':location}});

    let objResponse = await getData('/locations/'+location+'/objects/');
    if (objResponse[0] !== 200) {
      agent.add(`I'm very sorry, but I am having some problems checking the scene. Can you please try again?`);
      return
    }
    locationObjects = objResponse[1].objects;
    if (locationObjects.length === 0) {
      agent.add(`It looks like there aren't any objects at the ${location}.`);
      return
    } else if (locationObjects.length === 1) {
      agent.add(`It looks like there is one object at the ${location}. It's the ${objectToString(locationObjects[0],false)}.`);
      return
    } else {
      agent.add(`It looks like there are ${locationObjects.length} objects there. The ${stringArrayToWords(locationObjects.map((object)=>(objectToString(object,false))))}.`);
      return
    }
  }

  async function moveObjectRequestIntent() {
    console.log('moveObjectRequestIntent')
    // Move the active item to a location
    agent.context.set({'name':'current-objective',
                       'lifespan':5,
                       'parameters':{'goal':'moveObject'}});

    objectType = agent.parameters.object;
    objectColor = agent.parameters.color;
    location = agent.parameters.location;

    if (notEmpty(location)) {
      agent.context.set({'name':'current-location',
                         'lifespan':5,
                         'parameters':{'name':location}})
    }
    // Fetch objects, and compare against the focused and parameterized inputs
    let response = await getData('/objects/')
    if (response[0] !== 200) {
      agent.add(`I'm very sorry, but I am having some problems checking the scene. Can you please try again?`);
      return
    }
    allObjects = response[1].objects;
    matched = findObject(agent.parameters.object, agent.parameters.color, null, allObjects);
    if (matched.length == 0) {
      agent.add(`I'm not familiar with that object. I only know about the ${stringArrayToWords(allObjects.map((object)=>objectToString(object,false)))}. Which one did you want to move?`);
      return;
    } else if (matched.length > 1) {
      agent.add(`It looks like there is a ${stringArrayToWords(matched.map((object)=>objectToString(object,true)))}. Which one did you want me to move?`);
      return
    }
    if (notEmpty(location)) {
      console.log('location: '+location);
      await handleMove(matched[0].id,location);
    } else {
      console.log('location not defined')
      agent.context.set({'name':'current-object',
                         'lifespan':5,
                         'parameters':matched[0]})
      let phrase = `Sounds great. I'll move the ${objectToString(matched[0])}. Where would you like me to move it to?`;
      console.log(phrase);
      agent.add(`Sounds great. I'll move the ${objectToString(matched[0])}. Where would you like me to move it to?`)
      console.log('Complete')
      return
    }
  }

  let intentMap = new Map()
  intentMap.set('Default Welcome Intent', welcomeIntent);
  intentMap.set('FocusLocation', focusLocationIntent);
  intentMap.set('FocusObject', focusObjectIntent);
  intentMap.set('ClearFocus', clearFocusIntent);
  intentMap.set('ObjectLocationQuery', objectLocationQueryIntent);
  intentMap.set('LocationObjectQuery', locationObjectQueryIntent);
  intentMap.set('ObjectMoveRequest', moveObjectRequestIntent);
  agent.handleRequest(intentMap)
})

app.listen(process.env.PORT || 8080)
