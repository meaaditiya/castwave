
declare module 'simple-peer' {
    import { Duplex } from 'stream';

    namespace Peer {
        interface Options {
            initiator?: boolean;
            channelConfig?: object;
            channelName?: string;
            config?: object;
            constraints?: object;
            offerConstraints?: object;
            answerConstraints?: object;
            reconnectTimer?: boolean;
            sdpTransform?: (sdp: string) => string;
            stream?: MediaStream;
            trickle?: boolean;
            wrtc?: {
                RTCPeerConnection: any;
                RTCSessionDescription: any;
                RTCIceCandidate: any;
            };
            objectMode?: boolean;
        }

        interface SignalData {
            type?: 'offer' | 'answer' | 'renegotiate' | 'transceiverRequest';
            sdp?: string;
            candidate?: object;
            renegotiate?: boolean;
        }

        class Instance extends Duplex {
            constructor(opts?: Options);
            readonly destroyed: boolean;
            readonly connected: boolean;
            address(): { port: number; family: string; address: string; };
            signal(data: SignalData | string): void;
            send(data: string | number | Buffer | ArrayBuffer | Blob): void;
            destroy(err?: Error): void;
            addStream(stream: MediaStream): void;
            removeStream(stream: MediaStream): void;
            addTrack(track: MediaStreamTrack, stream: MediaStream): void;
            removeTrack(track: MediaStreamTrack, stream: MediaStream): void;
            replaceTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack, stream: MediaStream): void;
            on(event: 'signal', listener: (data: SignalData) => void): this;
            on(event: 'connect', listener: () => void): this;
            on(event: 'data', listener: (data: any) => void): this;
            on(event: 'stream', listener: (stream: MediaStream) => void): this;
            on(event: 'track', listener: (track: MediaStreamTrack, stream: MediaStream) => void): this;
            on(event: 'close', listener: () => void): this;
            on(event: 'error', listener: (err: Error) => void): this;
            on(event: string, listener: (...args: any[]) => void): this;
        }
    }

    const Peer: typeof Peer.Instance;
    export = Peer;
}
