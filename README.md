# Browsly

Browsly is a modern web application that leverages browser's native APIs and cutting-edge technologies like WebGPU to run AI models entirely locally in your browser. This enables completely private, offline, and secure execution of machine learning tasks without sending your personal data to any external server. 

Available exclusively on desktop platforms (Windows, macOS, Linux).

## ✨ Features

- **Language Translation**: Accurate real-time language translations offline.
- **Media Transcription**: High-quality local transcription for audio and video files.
- **Speech-to-Text**: Converts spoken words into text continuously in real-time.
- **Text-to-Speech**: Transform text inputs into natural-sounding speech.
- **PDF Summarization**: Automatically parse and generate summaries from large PDF documents without leaving your browser.
- **Image Captioning & Subtitles Generation**: Describe images and automatically generate subtitles using in-browser AI.

## 🛠️ Technology Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **Routing**: [@tanstack/react-router](https://tanstack.com/router)
- **State Management**: [@tanstack/react-query](https://tanstack.com/query)
- **AI / ML Engine**: [@huggingface/transformers (Transformers.js)](https://huggingface.co/docs/transformers.js/index)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/)
- **PDF Processing**: `react-pdftotext`

## 🚀 Getting Started

### Prerequisites

Ensure you have Node.js and a package manager (`yarn`, `npm`, or `pnpm`) installed. A WebGPU-compatible desktop browser (e.g., Chrome, Edge Beta/Dev on macOS/Windows) is highly recommended for hardware-accelerated model execution.

### Installation

1. Clone the repository and navigate into the project directory:
   ```sh
   git clone <repository_url>
   cd browlsy
   ```

2. Install dependencies (e.g. using yarn):
   ```sh
   yarn
   ```

3. Start the development server:
   ```sh
   yarn dev
   ```

4. The application will typically run at `http://localhost:5173`.

## 📦 Build for Production

To build the application for production, run:
```sh
yarn build
```
This will explicitly type-check the codebase (`tsc -b`) and bundle the optimized static site in the `dist/` directory using Vite.

## 🤝 Contributing

Contributions, issues, and feature requests are always welcome! Feel free to raise an issue or submit a pull request if you want to contribute to the project.

## 📝 License

This project is open-source.
