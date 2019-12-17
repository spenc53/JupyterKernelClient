import { Subscriber, Request, Dealer } from 'zeromq';

// 'hb' : zmq.REQ,
// 'shell' : zmq.DEALER,
// 'iopub' : zmq.SUB,
// 'stdin' : zmq.DEALER,
// 'control': zmq.DEALER,

export class JupyterKernelClient {
    shell: Dealer;
    ioPub: Subscriber;
    stdin: Dealer;
    control: Dealer;
    heartbeat: Request;

    decoder: TextDecoder = new TextDecoder()

    constructor(config: KernelConfig) {
        const base_url = `${config.transport}://${config.ip}`;

        this.shell = new Dealer()
        this.shell.connect(`${base_url}:${config.shell_port}`);

        this.ioPub = new Subscriber();
        this.ioPub.connect(`${base_url}:${config.iopub_port}`);
        this.ioPub.subscribe('');

        this.stdin = new Dealer();
        this.stdin.connect(`${base_url}:${config.stdin_port}`);

        this.control = new Dealer();
        this.control.connect(`${base_url}:${config.control_port}`);

        this.heartbeat = new Request();
        this.heartbeat.connect(`${base_url}:${config.hb_port}`);
    }

    recv_message(messages: Buffer[]): any {
        let thing: JupyterMessage = {};
        let decodedMessages = messages.map((message) => this.decoder.decode(message))

        thing.ids = [];
        let indexOfDelim = decodedMessages.indexOf("<IDS|MSG>");
        for (let i = 0; i < indexOfDelim; i++) {
            thing.ids.push(decodedMessages[i]);
        }
        thing.delimiter = "<IDS|MSG>";
        thing.hmac = decodedMessages[indexOfDelim + 1];
        thing.header = JSON.parse(decodedMessages[indexOfDelim + 2]);
        thing.parent_header = JSON.parse(decodedMessages[indexOfDelim + 3]);
        thing.metadata = JSON.parse(decodedMessages[indexOfDelim + 4]);
        thing.content = JSON.parse(decodedMessages[indexOfDelim + 5]);
        if (indexOfDelim + 6 < messages.length) {
            thing.buffer = messages.reverse()[0]; // what if it doesn't exist?
        }
        // console.log(thing)
        console.log(JSON.stringify(thing.content, null, 2))
        return thing.content;
    }

    async subscribeToIOLoop(messageReciever: MessageReciever) {
        while (true) {
            const messages = await this.ioPub.receive();
            const data = this.recv_message(messages);
            messageReciever(data);
        }
    }



    async getKernelInfo() {
        const data = {
            msgType: 'kernel_info_request',
            content: {}
        }
        console.log('request for kernel_info')
        await this.shell.send([
            "<IDS|MSG>",
            "",
            JSON.stringify(this.getHeader()),
            "{}",
            "{}",
            "{}"
        ]);

        const messages = await this.shell.receive()

        this.recv_message(messages);
    }

    getHeader() {
        return {
            msg_id: "1",
            msg_type: "kernel_info_request"
        }
    }
}


export interface JupyterMessage {
    ids?: any[];
    delimiter?: string;
    hmac?: string;
    header?: {};
    parent_header?: {};
    metadata?: {};
    content?: {};
    buffer?: any // not sure what this is
}

export interface KernelConfig {
    shell_port: string;
    iopub_port: string;
    stdin_port: string;
    control_port: string;
    hb_port: string;
    ip: string;
    key: string;
    transport: string;
    signature_scheme: string;
    kernel_name: string;
}

interface MessageReciever {
    (data: any): void;
};


// const config: KernelConfig = {
//     shell_port: "53794",
//     iopub_port: "53795",
//     stdin_port: "53796",
//     control_port: "53797",
//     hb_port: "53798",
//     key: "",
//     ip: "127.0.0.1",
//     transport: "tcp",
//     signature_scheme: "",
//     kernel_name: ""
// }

// const j = new JupyterKernelClient(config);
// j.getKernelInfo();
// j.startIOPubLoop()









// security stuff
// https://stackoverflow.com/questions/7480158/how-do-i-use-node-js-crypto-to-create-a-hmac-sha1-hash