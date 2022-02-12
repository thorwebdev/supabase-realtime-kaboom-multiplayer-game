import kaboom from "kaboom"
import {createClient} from '@supabase/supabase-js'
import { RealtimeClient } from '@supabase/realtime-js'

// Init Supabase
const supaUrl = "https://jfjboqfvzmvqoxueioco.supabase.co"
const supaAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmamJvcWZ2em12cW94dWVpb2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDQ2MDQ3NzMsImV4cCI6MTk2MDE4MDc3M30.T5iwAaBZkzwFmU-l8cqlPVrwJy5wSLTL8EiAHD6dnDQ"
const supa = createClient(supaUrl, supaAnonKey)
// Init RealtimeClient
const socket = new RealtimeClient('wss://multiplayer-demo.fly.dev/socket', {
  params: { apikey: supaAnonKey },
})
socket.connect()
const channel = socket.channel('multiplayer:pos')
channel.subscribe()


// initialize context
kaboom({
	logMax: 1,
})

// Define player movement speed (pixels per second)
const SPEED = 320

// load assets
loadSprite("bean", "sprites/bean.png")

const MAX_PLAYERS = 2;
const COLORS = [RED, GREEN, BLUE, YELLOW]
let player;

function initPlayer() {
  // Insert new player into database
  supa.from('players').insert({user_id: null}).then(({data}) => {
    const row = data[0]
    players[row.id] = add([
      // list of components
      sprite("bean"),
	  pos(row.x * width(), row.y * height()),
      area(),
      scale(width() * 0.0005), // TODO figure out how to do properly
      color(COLORS[row.color -1]),
      "player",
		{ playerId: row.id },
    ])
    player = players[row.id]
    channel.push('pos', { playerId: row.id, x: row.x / width(), y: row.y / height() })

    player.onCollide("player", (cPlayer) => {
      // TODO check for color mechanic based on player ids
      console.log(cPlayer.playerId)
      destroy(cPlayer)
      // TODO send collision data to DB
    })

    // onKeyDown() registers an event that runs every frame as long as user is holding a certain key
    onKeyDown("left", () => {
      // .move() is provided by pos() component, move by pixels per second
      player.move(-SPEED, 0)
      if (player.pos.x < 0) {
        player.pos.x = width() - player.width
      }
    })

    onKeyDown("right", () => {
      player.move(SPEED, 0)
      if (player.pos.x > width() - player.width) {
        player.pos.x = 0
      }
    })

    onKeyDown("up", () => {
      player.move(0, -SPEED)
      if (player.pos.y < 0) {
        player.pos.y = height() - player.height
      }
    })

    onKeyDown("down", () => {
      player.move(0, SPEED)
      if (player.pos.y > height() - player.height) {
        player.pos.y = 0
      }
    })

    let lastPos = player.pos.toString()
    // runs 60 times per seconds
    onUpdate(() => {
      debug.log(player.pos.toString())
      // if (++counter === 60) {
        // Only update the DB every second
      if (lastPos !== player.pos.toString()) {
        lastPos = player.pos.toString()
        console.log(player.pos.x / width(), player.pos.y / height())
        // supa.from('players').update({
        //   x: player.pos.x / width(),
        //   y: player.pos.y / height()
        // }).match({id: player.playerId}).then(res => console.log(res))
        channel.push('pos', { playerId: player.playerId, x: player.pos.x / width(), y: player.pos.y / height() })
      }
    })
  })
}

// Retrieve all players
const players = {}
supa.from('players').select('*').then(({data: rows}) => {
  rows.map(row => {
    console.log(row)
    players[row.id] = add([
      // list of components
      sprite("bean"),
	  pos(row.x * width(), row.y * height()),
      area(),
      scale(width() * 0.0005), // TODO figure out how to do properly
      color(COLORS[row.color -1]),
      "player",
		{ playerId: row.id },
    ])
  })
  // All players loaded, now offer to join the game
  if (window.confirm("Join the game?")) {
    initPlayer()
  }
})

// Stream all player locations from Database
const playerStream = supa
  .from('players')
  .on('*', payload => {
    const data = payload.new;
    const dbPlayer = players[data.id];
    if (!dbPlayer || dbPlayer.playerId === player?.playerId) return
    dbPlayer.pos.x = data.x * width();
    dbPlayer.pos.y = data.y * height();
  })
  // .subscribe()

// receive websocket events
channel.on('pos', data => {
  console.log(data)
    let dbPlayer = players[data.playerId];
    if (!dbPlayer) {
      // New player joined, let's create them
      players[data.playerId] = add([
        // list of components
        sprite("bean"),
      pos(data.x * width(), data.y * height()),
        area(),
        scale(width() * 0.0005), // TODO figure out how to do properly
        color(COLORS[3]), // TODO stream color over websocket
        "player",
      { playerId: data.playerId },
      ])
      dbPlayer = players[data.playerId];
      console.log('New player added:', dbPlayer, data)
    }
    dbPlayer.pos.x = data.x * width();
    dbPlayer.pos.y = data.y * height();
})

// add a kaboom on mouse click
onClick(() => {
	addKaboom(mousePos())
})

// burp on "b"
onKeyPress("b", burp)