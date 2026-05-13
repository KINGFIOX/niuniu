// Push-to-talk recorder that captures mono 16-bit PCM @ 16kHz and packages
// the result as a WAV Blob. Uses ScriptProcessorNode for maximum browser
// compatibility (deprecated but universally supported; AudioWorklet requires
// a separate module file which would need bundling).
//
// Usage:
//   const rec = new PcmRecorder();
//   await rec.start();        // throws on permission denial / no mic
//   ...
//   const wavBlob = await rec.stop();  // Blob({ type: 'audio/wav' })

const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

export class PcmRecorder {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private inputSampleRate = 0;

  static get isSupported(): boolean {
    if (typeof window === "undefined") return false;
    const hasMic = !!navigator.mediaDevices?.getUserMedia;
    const hasCtx =
      typeof window.AudioContext !== "undefined" ||
      // @ts-expect-error legacy
      typeof window.webkitAudioContext !== "undefined";
    return hasMic && hasCtx;
  }

  async start(): Promise<void> {
    if (!PcmRecorder.isSupported) {
      throw new Error("Recording is not supported in this browser");
    }
    this.chunks = [];

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.mediaStream = stream;

    const Ctor =
      window.AudioContext ||
      // @ts-expect-error legacy Safari prefix
      window.webkitAudioContext;
    this.audioCtx = new Ctor();
    this.inputSampleRate = this.audioCtx.sampleRate;

    this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
    this.processorNode = this.audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
    this.processorNode.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      // Copy because the buffer is reused by the browser.
      this.chunks.push(new Float32Array(input));
    };
    this.sourceNode.connect(this.processorNode);
    // ScriptProcessor needs to be connected to destination to tick, but we
    // mute via a gain=0 node so users don't hear themselves echoed.
    const muteGain = this.audioCtx.createGain();
    muteGain.gain.value = 0;
    this.processorNode.connect(muteGain);
    muteGain.connect(this.audioCtx.destination);
  }

  async stop(): Promise<Blob> {
    if (!this.audioCtx || !this.processorNode || !this.sourceNode) {
      throw new Error("Recorder is not running");
    }

    try {
      this.processorNode.disconnect();
      this.sourceNode.disconnect();
    } catch {
      // ignore
    }
    if (this.audioCtx.state !== "closed") {
      try {
        await this.audioCtx.close();
      } catch {
        // ignore
      }
    }
    this.mediaStream?.getTracks().forEach((t) => t.stop());

    const merged = mergeFloat32(this.chunks);
    const downsampled = downsampleBuffer(
      merged,
      this.inputSampleRate,
      TARGET_SAMPLE_RATE,
    );
    const int16 = floatTo16BitPcm(downsampled);
    const wav = encodeWav(int16, TARGET_SAMPLE_RATE);

    this.audioCtx = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.processorNode = null;
    this.chunks = [];

    return new Blob([wav], { type: "audio/wav" });
  }

  abort() {
    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch {}
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
    }
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {});
    }
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.chunks = [];
    this.audioCtx = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.processorNode = null;
  }
}

function mergeFloat32(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function downsampleBuffer(
  buf: Float32Array,
  inRate: number,
  outRate: number,
): Float32Array {
  if (outRate === inRate) return buf;
  if (outRate > inRate) {
    throw new Error("downsampling only");
  }
  const ratio = inRate / outRate;
  const newLen = Math.floor(buf.length / ratio);
  const out = new Float32Array(newLen);
  let offResult = 0;
  let offBuf = 0;
  while (offResult < newLen) {
    const nextOffBuf = Math.floor((offResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offBuf; i < nextOffBuf && i < buf.length; i++) {
      accum += buf[i];
      count++;
    }
    out[offResult] = count > 0 ? accum / count : 0;
    offResult++;
    offBuf = nextOffBuf;
  }
  return out;
}

function floatTo16BitPcm(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function encodeWav(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  let offset = 0;

  function writeString(s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
  }
  function writeUint32(v: number) {
    view.setUint32(offset, v, true);
    offset += 4;
  }
  function writeUint16(v: number) {
    view.setUint16(offset, v, true);
    offset += 2;
  }

  writeString("RIFF");
  writeUint32(36 + samples.length * 2);
  writeString("WAVE");
  writeString("fmt ");
  writeUint32(16); // PCM chunk size
  writeUint16(1); // audio format = PCM
  writeUint16(1); // channels = mono
  writeUint32(sampleRate);
  writeUint32(sampleRate * 2); // byte rate (16-bit mono)
  writeUint16(2); // block align
  writeUint16(16); // bits per sample
  writeString("data");
  writeUint32(samples.length * 2);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }
  return buffer;
}
