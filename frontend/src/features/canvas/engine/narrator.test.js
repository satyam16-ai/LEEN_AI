import { Narrator, VOICES } from './narrator';

class FakeAudio {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.paused = true;
    this.ended = false;
    this.playbackRate = 1;
    FakeAudio.instances.push(this);
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  end() {
    this.ended = true;
    this.onended?.();
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Narrator', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal('Audio', FakeAudio);
    let counter = 0;
    vi.stubGlobal('URL', {
      createObjectURL: () => `blob:${(counter += 1)}`,
      revokeObjectURL: () => {},
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('fetches spoken text once per caption and plays it at the board speed', async () => {
    const fetchAudio = vi.fn().mockResolvedValue(new Blob(['mp3']));
    const narrator = new Narrator(fetchAudio);
    narrator.setVoice('prabhat');
    narrator.setRate(1.5);

    narrator.prefetch('So (x+y)^2 = x^2 + 2xy + y^2');
    const spoken = narrator.speak('So (x+y)^2 = x^2 + 2xy + y^2');
    await flush();

    expect(fetchAudio).toHaveBeenCalledTimes(1);
    expect(fetchAudio).toHaveBeenCalledWith(
      'So (x plus y) whole squared equals x squared plus 2 x y plus y squared',
      'prabhat'
    );
    const [audio] = FakeAudio.instances;
    expect(audio.paused).toBe(false);
    expect(audio.playbackRate).toBe(1.5);

    audio.end();
    await expect(spoken).resolves.toBeUndefined();
  });

  it('pauses and resumes the current audio, and stop() finishes it', async () => {
    const narrator = new Narrator(vi.fn().mockResolvedValue(new Blob(['mp3'])));
    const spoken = narrator.speak('Hello');
    await flush();
    const [audio] = FakeAudio.instances;

    narrator.pause();
    expect(audio.paused).toBe(true);
    narrator.resume();
    expect(audio.paused).toBe(false);

    narrator.stop();
    expect(audio.paused).toBe(true);
    await expect(spoken).resolves.toBeUndefined();
  });

  it('falls back to the browser voice when the server voice fails', async () => {
    const speak = vi.fn((utterance) => utterance.onend());
    vi.stubGlobal('speechSynthesis', { getVoices: () => [], speak, cancel: vi.fn() });
    vi.stubGlobal('SpeechSynthesisUtterance', function Utterance(text) {
      this.text = text;
    });
    const fetchAudio = vi.fn().mockRejectedValue(new Error('503'));
    const narrator = new Narrator(fetchAudio);

    await narrator.speak('x^2');
    await narrator.speak('y^2');

    expect(speak).toHaveBeenCalledTimes(2);
    expect(speak.mock.calls[0][0].text).toBe('x squared');
    // After a failure the server is not asked again straight away.
    expect(fetchAudio).toHaveBeenCalledTimes(1);
  });

  it('offers Hindi voices', () => {
    expect(VOICES.ishita).toMatch(/Hindi/);
    expect(VOICES.shubh).toMatch(/Hindi/);
  });

  it('falls back to a Hindi browser voice for a Hindi voice', async () => {
    const english = { name: 'Google UK English Female', lang: 'en-GB' };
    const hindi = { name: 'Google हिन्दी', lang: 'hi-IN' };
    const speak = vi.fn((utterance) => utterance.onend());
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [english, hindi],
      speak,
      cancel: vi.fn(),
    });
    vi.stubGlobal('SpeechSynthesisUtterance', function Utterance(text) {
      this.text = text;
    });
    const narrator = new Narrator(vi.fn().mockRejectedValue(new Error('503')));
    narrator.setVoice('ishita');

    await narrator.speak('Dekho');

    const [utterance] = speak.mock.calls[0];
    expect(utterance.voice).toBe(hindi);
    expect(utterance.lang).toBe('hi-IN');
  });
});
