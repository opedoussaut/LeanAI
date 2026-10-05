import { Config } from '@remotion/cli/config';
import { existsSync } from 'node:fs';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setConcurrency(2);
Config.setPixelFormat('yuv420p');

// Use a locally installed headless Chromium when present (offline/CI); otherwise Remotion downloads its own.
const local = process.env.REMOTION_BROWSER ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(local)) Config.setBrowserExecutable(local);
