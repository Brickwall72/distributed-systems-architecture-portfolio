// File: .storybook/main.ts
import { StorybookConfig } from '@storybook/react-vite';
import tailwindVite from '@tailwindcss/vite';

const config: StorybookConfig = {
  stories: ['../services/**/src/**/*.stories.@(ts|tsx|js|jsx)', '../packages/**/src/**/*.stories.@(ts|tsx|js|jsx)'],
  staticDirs: ['../public'],
  addons: [
    '@storybook/addon-links',
    'msw-storybook-addon' // <-- Add this to the array
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    if (config.resolve) {
      config.resolve.alias = [
        {
          find: /^(\.\.?\/.*)\.js$/,
          replacement: '$1'
        }
      ];
      config.resolve.extensions = ['.tsx', '.ts', '.jsx', '.js'];
    }
    
    // Remount the native Tailwind v4 compilation plugin into the dev engine
    config.plugins = config.plugins || [];
    config.plugins.push(tailwindVite());
    
    return config;
  }
};

export default config;
