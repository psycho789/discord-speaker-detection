import { OpusEncoder } from "@discordjs/opus";
import {
  EndBehaviorType,
  entersState,
  VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { Client } from "discord.js";
import { Transform } from "stream";

declare module "discord.js" {
  interface ClientEvents {
    speaking: [data: Uint8Array];
  }
}

class OpusDecodingStream extends Transform {
  encoder: OpusEncoder;

  constructor() {
    super();
    this.encoder = new OpusEncoder(48000, 2);
  }

  _transform(data: any, encoding: any, callback: () => void) {
    this.push(this.encoder.decode(data));
    callback();
  }
}

/**
 * Starts listening on connection and emits `speech` event when someone stops speaking
 * @param connection Connection to listen
 */
const handleSpeakingEvent = <T>({
  client,
  connection
}: {
  client: Client;
  connection: VoiceConnection;
}) => {
  connection.receiver.speaking.on(
    "start",
    function handleSpeechEventOnConnectionReceiver(userId) {
      const user = client.users.cache.get(userId);

      // Shouldn't proceed if user is undefined, some checks will fail even if they shouldn't
      if (!user) return;

      const { receiver } = connection;

      // Subscribe to the "end" event, which happens after 300ms of silence.
      const opusStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 300,
        },
      });

      const bufferData: Uint8Array[] = [];
      opusStream
        .pipe(new OpusDecodingStream())
        .on("data", (data: Uint8Array) => {
          console.log('speaking', data);
          client.emit("speaking", data);
        });

    }
  );
};

/**
 * Enables `speech` event on Client, which is called whenever someone stops speaking
 */
export default <T>(
  client: Client
): void => {
  client.on("voiceJoin", async (connection) => {
    if (!connection) {
      return;
    }

    await entersState(connection, VoiceConnectionStatus.Ready, 20e3);
    handleSpeakingEvent({ client, connection });
  });
};
