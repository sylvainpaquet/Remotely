import * as UI from "./UI.js";
import * as Utilities from "../Utilities.js";
import { Remotely } from "./Main.js";
import { DynamicDtoType } from "../Models/DynamicDtoType.js";
export class RtcSession {
    constructor() {
        this.FpsStack = [];
        this.MessagePack = window['MessagePack'];
        this.PartialFrames = [];
    }
    Init() {
        this.PeerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: "stun: stun.l.google.com:19302" },
                { urls: "stun:stun4.l.google.com:19302" }
            ]
        });
        this.PeerConnection.ondatachannel = (ev) => {
            console.log("Data channel received.");
            this.DataChannel = ev.channel;
            this.DataChannel.binaryType = "arraybuffer";
            this.DataChannel.onbufferedamountlow = (ev) => {
                console.log("Buffer amount low.");
            };
            this.DataChannel.onclose = (ev) => {
                console.log("Data channel closed.");
                UI.ConnectionP2PIcon.style.display = "none";
                UI.ConnectionRelayedIcon.style.display = "unset";
            };
            this.DataChannel.onerror = (ev) => {
                console.log("Data channel error.", ev.error);
                UI.ConnectionP2PIcon.style.display = "none";
                UI.ConnectionRelayedIcon.style.display = "unset";
            };
            this.DataChannel.onmessage = async (ev) => {
                var data = ev.data;
                this.ParseBinaryMessage(data);
            };
            this.DataChannel.onopen = (ev) => {
                console.log("Data channel opened.");
                UI.ConnectionP2PIcon.style.display = "unset";
                UI.ConnectionRelayedIcon.style.display = "none";
            };
        };
        this.PeerConnection.onconnectionstatechange = function (ev) {
            console.log("Connection state changed to " + this.connectionState);
            if (this.connectionState != "connected") {
                UI.ConnectionP2PIcon.style.display = "none";
                UI.ConnectionRelayedIcon.style.display = "unset";
            }
        };
        this.PeerConnection.oniceconnectionstatechange = function (ev) {
            console.log("ICE connection state changed to " + this.iceConnectionState);
            if (this.iceConnectionState != "connected") {
                UI.ConnectionP2PIcon.style.display = "none";
                UI.ConnectionRelayedIcon.style.display = "unset";
            }
        };
        this.PeerConnection.onicecandidate = async (ev) => {
            await Remotely.RCBrowserSockets.SendIceCandidate(ev.candidate);
        };
    }
    ParseBinaryMessage(data) {
        var model = this.MessagePack.decode(data);
        switch (model.DtoType) {
            case DynamicDtoType.FrameInfo:
                this.ProcessFrameInfo(model);
                break;
            default:
        }
    }
    ProcessFrameInfo(frameInfo) {
        if (frameInfo.EndOfFrame) {
            var url = window.URL.createObjectURL(new Blob(this.PartialFrames));
            var img = document.createElement("img");
            img.onload = () => {
                UI.Screen2DContext.drawImage(img, frameInfo.Left, frameInfo.Top, frameInfo.Width, frameInfo.Height);
                window.URL.revokeObjectURL(url);
            };
            img.src = url;
            this.PartialFrames = [];
            if (Remotely.Debug) {
                this.FpsStack.push(Date.now());
                while (Date.now() - this.FpsStack[0] > 1000) {
                    this.FpsStack.shift();
                }
                console.log("FPS: " + String(this.FpsStack.length));
            }
        }
        else {
            this.PartialFrames.push(frameInfo.ImageBytes);
        }
    }
    Disconnect() {
        this.PeerConnection.close();
    }
    async ReceiveRtcOffer(sdp) {
        await this.PeerConnection.setRemoteDescription({ type: "offer", sdp: sdp });
        Utilities.When(() => {
            return this.PeerConnection.remoteDescription.sdp.length > 0;
        }).then(async () => {
            await this.PeerConnection.setLocalDescription(await this.PeerConnection.createAnswer());
            await Remotely.RCBrowserSockets.SendRtcAnswer(this.PeerConnection.localDescription);
        });
    }
    async ReceiveCandidate(candidate) {
        Utilities.When(() => {
            return this.PeerConnection.remoteDescription.sdp.length > 0;
        }).then(async () => {
            await this.PeerConnection.addIceCandidate(candidate);
            console.log("Set ICE candidate.");
        });
    }
}
//# sourceMappingURL=RtcSession.js.map