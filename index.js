const {app, BrowserWindow} = require('electron')
const electron = require('electron');
const path = require('path')

const nativeTheme = electron.nativeTheme;
const Mpris = require('mpris-service');
let pos_atr = {durationInMillis: 0};
let currentPlayBackProgress = "0";
const mpris = Mpris({
    name: 'AppleMusicForLinux',
    identity: 'Apple Music For Linux',
    supportedUriSchemes: [],
    supportedMimeTypes: [],
    supportedInterfaces: ['player']
});
mpris.getPosition = function () {
    const durationInMicro = pos_atr.durationInMillis * 1000;
    const percentage = parseFloat(currentPlayBackProgress) || 0;
    return durationInMicro * percentage;
}
mpris.canQuit = true;
mpris.canControl = true;
mpris.canPause = true;
mpris.canPlay = true;
mpris.canGoNext = true;
mpris.metadata = {'mpris:trackid': '/org/mpris/MediaPlayer2/TrackList/NoTrack'}
mpris.playbackStatus = 'Stopped'

const playbackStatusPlay = 'Playing';
const playbackStatusPause = 'Paused';
const playbackStatusStop = 'Stopped';


function setPlaybackIfNeeded(status) {
    if (mpris.playbackStatus === status) {
        return
    }
    mpris.playbackStatus = status;
}

async function createWindow() {

    let win = new BrowserWindow({
        icon: path.join(__dirname, './assets/icon.png'),
        width: 1024,
        height: 600,
        minWidth: 300,
        minHeight: 300,
        webPreferences: {
            plugins: true,
            preload: path.join(__dirname, './assets/MusicKitInterop.js'),
            allowRunningInsecureContent: true, contextIsolation:false, nativeWindowOpen:true, backgroundThrottling:false, autoplayPolicy:'no-user-gesture-required'
        }
    })
    win.setMenuBarVisibility(false);
    win.on('close', function(e) {
        e.preventDefault();
        win.destroy();
    });

    mpris.on('playpause', async () => {
        if (mpris.playbackStatus === 'Playing') {
            await win.webContents.executeJavaScript('MusicKit.getInstance().pause()')
        } else {
            await win.webContents.executeJavaScript('MusicKit.getInstance().play()')
        }
    });
    mpris.on('play', async () => {
        await win.webContents.executeJavaScript('MusicKit.getInstance().play()')
    });
    mpris.on('pause', async () => {
        await win.webContents.executeJavaScript('MusicKit.getInstance().pause()')
    });
    mpris.on('next', async () => {
        await win.webContents.executeJavaScript('MusicKit.getInstance().skipToNextItem()')
    });
    mpris.on('previous', async () => {
        await win.webContents.executeJavaScript('MusicKit.getInstance().skipToPreviousItem()')
    });


    electron.ipcMain.on('mediaItemStateDidChange', (item, a) => {
        updateMetaData(a)
    })

    electron.ipcMain.on('playbackStateDidChange', (item, a) => {
        switch (a) {
            case 0:
                console.log("NONE")
                setPlaybackIfNeeded(playbackStatusPause);
                break;
            case 1:
                console.log("loading")
                setPlaybackIfNeeded(playbackStatusPause);
                break;
            case 2:
                console.log("playing")
                setPlaybackIfNeeded(playbackStatusPlay);
                break;
            case 3:
                console.log("paused")
                setPlaybackIfNeeded(playbackStatusPause);
                break;
            case 4:
                console.log("stopped")
                setPlaybackIfNeeded(playbackStatusStop);
                break;
            case 5:
                console.log("ended")
                break;
            case 6:
                console.log("seeking")
                break;
            case 7:
                console.log("waiting")
                break;
            case 8:
                console.log("stalled")
                console.log()
                break;
            case 9:
                console.log("completed")
                break;

        }

    })



    win.webContents.once('did-stop-loading', async () => {
        await win.webContents.executeJavaScript(`MusicKitInterop.init()`)
        await win.webContents.insertCSS('::-webkit-scrollbar { display: none; }')
    })

    await win.loadURL("https://music.apple.com", {userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:87.0) Gecko/20100101 Firefox/87.0'});
    async function updateMetaData(attributes) {

        let m = {'mpris:trackid': '/org/mpris/MediaPlayer2/TrackList/NoTrack'}
        if (attributes == null) {
            return
        } else if (attributes.playParams.id === 'no-id-found') {

        } else {
            let url = `${attributes.artwork.url.replace('/{w}x{h}bb', '/35x35bb')}`
            url = `${url.replace('/2000x2000bb', '/35x35bb')}`
            m = {
                'mpris:trackid': mpris.objectPath(`track/${attributes.playParams.id.replace(/[\.]+/g, "")}`),
                'mpris:length': attributes.durationInMillis * 1000, // In microseconds
                'mpris:artUrl': url,
                'xesam:title': `${attributes.name}`,
                'xesam:album': `${attributes.albumName}`,
                'xesam:artist': [`${attributes.artistName}`,],
                'xesam:genre': attributes.genreNames
            }
        }
        if (mpris.metadata["mpris:trackid"] === m["mpris:trackid"]) {
            return
        }
        mpris.metadata = m
    }


}


nativeTheme.themeSource = 'dark';
app.commandLine.appendSwitch('--enable-widevine')
app.commandLine.appendSwitch('--no-sandbox')
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
app.addListener("will-quit", () => {
})
app.on('widevine-ready', createWindow)
app.on('widevine-error', (error) => {
    console.log('Widevine installation encountered an error: ' + error)
    process.exit(1)
})
app.on('window-all-closed', () => {
    mpris.metadata = {'mpris:trackid': '/org/mpris/MediaPlayer2/TrackList/NoTrack'}
    mpris.playbackStatus = 'Stopped';
    app.quit()
})
app.on('quit', () => {
    mpris.metadata = {'mpris:trackid': '/org/mpris/MediaPlayer2/TrackList/NoTrack'}
    mpris.playbackStatus = 'Stopped';
    app.quit()
})

