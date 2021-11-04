module.exports = () => {
    const RPC = require('discord-rpc')
    const client = new RPC.Client({
        transport: 'ipc'
    })

    client.on('ready', async () => {
        client.setActivity({      
            activity: {
                details: 'Editing test.js'
            },
            largeImageKey: '',
            largeImageText: 'Editing a file',
            timestamps: {
                start: Date.now()
            }
        }).catch(err => { console.log(err) })
    })

    client.login({
        clientId: '905532587072708768'
    }).catch(err => { console.log(err) })
}
