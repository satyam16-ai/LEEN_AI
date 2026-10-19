import { act, renderHook } from '@testing-library/react';

import { sttService } from '@/services/sttService';

import { useSpeechInput } from './useSpeechInput';

vi.mock('@/services/sttService', () => ({ sttService: { transcribe: vi.fn() } }));

class FakeRecognition {
  static last = null;

  constructor() {
    FakeRecognition.last = this;
    this.started = false;
  }

  start() {
    this.started = true;
  }

  stop() {
    this.onend?.();
  }

  abort() {
    this.onend?.();
  }

  say(text, isFinal) {
    const result = Object.assign([{ transcript: text }], { isFinal });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
}

class FakeRecorder {
  static last = null;

  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.mimeType = 'audio/webm';
    FakeRecorder.last = this;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  sttService.transcribe.mockReset();
});

describe('useSpeechInput in English (browser speech recognition)', () => {
  beforeEach(() => vi.stubGlobal('SpeechRecognition', FakeRecognition));

  it('start listens and reports interim text', () => {
    const { result } = renderHook(() => useSpeechInput({ onFinal: vi.fn() }));
    expect(result.current.supported).toBe(true);

    act(() => result.current.start());
    act(() => FakeRecognition.last.say('why is', false));

    expect(FakeRecognition.last.lang).toBe('en-IN');
    expect(result.current.listening).toBe(true);
    expect(result.current.interim).toBe('why is');
  });

  it('the final transcript is sent once', () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeechInput({ onFinal }));

    act(() => result.current.start());
    act(() => FakeRecognition.last.say('  why is it upside down ', true));
    act(() => FakeRecognition.last.stop());

    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith('why is it upside down');
    expect(result.current.listening).toBe(false);
  });

  it('blocked microphone shows a message', () => {
    const { result } = renderHook(() => useSpeechInput({ onFinal: vi.fn() }));

    act(() => result.current.start());
    act(() => FakeRecognition.last.onerror({ error: 'not-allowed' }));

    expect(result.current.error).toBe('Microphone access is blocked.');
  });
});

it('unsupported browsers report supported: false', () => {
  vi.stubGlobal('SpeechRecognition', undefined);
  vi.stubGlobal('webkitSpeechRecognition', undefined);
  const { result } = renderHook(() => useSpeechInput({ onFinal: vi.fn() }));
  expect(result.current.supported).toBe(false);
});

describe('useSpeechInput in Hindi (recorded, transcribed by Sarvam)', () => {
  let track;

  beforeEach(() => {
    track = { stop: vi.fn() };
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
    });
  });

  it('hindi records, uploads and sends the transcript', async () => {
    sttService.transcribe.mockResolvedValue('yeh triangle hai');
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeechInput({ lang: 'hi-IN', onFinal }));
    expect(result.current.supported).toBe(true);

    await act(async () => result.current.start());
    expect(result.current.listening).toBe(true);
    expect(result.current.interim).toBe('Listening…');

    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(sttService.transcribe).toHaveBeenCalledWith(expect.any(Blob));
    expect(onFinal).toHaveBeenCalledWith('yeh triangle hai');
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });

  it('hindi stops by itself after 15 seconds', async () => {
    vi.useFakeTimers();
    sttService.transcribe.mockResolvedValue('theek hai');
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeechInput({ lang: 'hi-IN', onFinal }));

    await act(async () => result.current.start());
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });

    expect(FakeRecorder.last.state).toBe('inactive');
    expect(sttService.transcribe).toHaveBeenCalledTimes(1);
  });

  it('a second tap during the permission prompt starts nothing', async () => {
    let grant;
    navigator.mediaDevices.getUserMedia.mockReturnValue(
      new Promise((resolve) => {
        grant = () => resolve({ getTracks: () => [track] });
      })
    );
    const recorders = vi.spyOn(globalThis, 'MediaRecorder');
    const { result } = renderHook(() => useSpeechInput({ lang: 'hi-IN', onFinal: vi.fn() }));

    let first;
    act(() => {
      first = result.current.start();
      result.current.start();
    });
    await act(async () => {
      grant();
      await first;
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(recorders).toHaveBeenCalledTimes(1);
  });

  it('closing during the permission prompt records and sends nothing', async () => {
    let grant;
    navigator.mediaDevices.getUserMedia.mockReturnValue(
      new Promise((resolve) => {
        grant = () => resolve({ getTracks: () => [track] });
      })
    );
    FakeRecorder.last = null;
    const onFinal = vi.fn();
    const { result, unmount } = renderHook(() => useSpeechInput({ lang: 'hi-IN', onFinal }));

    let starting;
    act(() => {
      starting = result.current.start();
    });
    unmount();
    await act(async () => {
      grant();
      await starting;
    });

    expect(track.stop).toHaveBeenCalled();
    expect(FakeRecorder.last).toBeNull();
    expect(onFinal).not.toHaveBeenCalled();
  });

  it("a failed upload shows the server's message", async () => {
    sttService.transcribe.mockRejectedValue(new Error('Voice input is unavailable right now.'));
    const { result } = renderHook(() => useSpeechInput({ lang: 'hi-IN', onFinal: vi.fn() }));

    await act(async () => result.current.start());
    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.error).toBe('Voice input is unavailable right now.');
  });
});
