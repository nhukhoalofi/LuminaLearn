import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface EnvironmentConfig {
  pythonExecutable: string;
  ffmpegExecutable: string;
  ffprobeExecutable: string;
  remotionCliExecutable: string;
  chromeExecutable?: string;
  renderOutputDirectory: string;
  renderConcurrency: number;
  geminiModel: string;
  geminiApiKey?: string;
  googleCloudProject?: string;
  googleApplicationCredentials?: string;
  isGoogleTtsEnabled: boolean;
}

/**
 * Tự động phân giải đường dẫn thực thi cross-platform (Windows & Linux/Docker)
 * Ưu tiên: Biến môi trường > Đường dẫn chuẩn theo OS > Fallback
 */
export function loadEnvironmentConfig(repositoryRoot: string): EnvironmentConfig {
  const isWindows = process.platform === 'win32';

  // Python executable
  let defaultPython = resolve(repositoryRoot, isWindows
    ? 'services/math-engine/.venv/Scripts/python.exe'
    : 'services/math-engine/.venv/bin/python');
  if (!existsSync(defaultPython)) {
    defaultPython = isWindows ? 'python.exe' : 'python3';
  }
  const pythonExecutable = process.env.PYTHON_EXECUTABLE || defaultPython;

  // Remotion CLI
  const defaultRemotionCli = resolve(repositoryRoot, 'apps/worker/node_modules/@remotion/cli/remotion-cli.js');
  const remotionCliExecutable = process.env.REMOTION_CLI_EXECUTABLE || defaultRemotionCli;

  // Chrome executable
  let defaultChrome: string | undefined;
  if (isWindows) {
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
    ];
    defaultChrome = winPaths.find((p) => existsSync(p)) || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  } else {
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    ];
    defaultChrome = linuxPaths.find((p) => existsSync(p)) || '/usr/bin/google-chrome';
  }
  const chromeExecutable = process.env.CHROME_EXECUTABLE || process.env.REMOTION_BROWSER_EXECUTABLE || defaultChrome;

  // FFmpeg / FFprobe
  const ffmpegExecutable = process.env.FFMPEG_EXECUTABLE || 'ffmpeg';
  const ffprobeExecutable = process.env.FFPROBE_EXECUTABLE || 'ffprobe';

  // Output directory
  const renderOutputDirectory = process.env.RENDER_OUTPUT_DIRECTORY
    ? resolve(repositoryRoot, process.env.RENDER_OUTPUT_DIRECTORY)
    : resolve(repositoryRoot, 'outputs');

  // Concurrency
  const renderConcurrency = Number(process.env.RENDER_CONCURRENCY || '1');

  // Gemini & Google Cloud
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  const googleApplicationCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const isGoogleTtsEnabled = Boolean(
    googleApplicationCredentials ||
    (googleCloudProject && process.env.GOOGLE_TTS_ENABLED === 'true')
  );

  return {
    pythonExecutable,
    ffmpegExecutable,
    ffprobeExecutable,
    remotionCliExecutable,
    chromeExecutable,
    renderOutputDirectory,
    renderConcurrency,
    geminiModel,
    geminiApiKey,
    googleCloudProject,
    googleApplicationCredentials,
    isGoogleTtsEnabled
  };
}

