# **App Name**: Sber Transcriber

## Core Features:

- File Upload: Allow users to upload audio or video files from their local storage.
- Read Env Config: Read API keys from the .env file
- Send to Sber API: Pass the file to Sber Salute Speech API for transcription. The API key should be configurable via the `.env` file.
- Fetch Transcription Result: Check status of transcription, and get result using the Sber Salute Speech API. This feature also encompasses any error handling and retry mechanisms.
- Display Transcription: Display the transcribed text in a readable format on the user interface.
- Download Text File: Enable users to download the transcribed text as a `.txt` file.

## Style Guidelines:

- Primary color: Deep purple (#673AB7) to signify technological prowess.
- Background color: Very light purple (#F3E5F5). A muted background helps to focus the user's attention on the transcription.
- Accent color: Blue-violet (#3F51B5) to draw attention to interactive elements like buttons.
- Body and headline font: 'Inter' (sans-serif) for a modern and clean interface.
- A clean, single-column layout to focus on the transcription process. Use clear sectioning for file upload, transcription display, and download options.
- Use recognizable icons for upload, download, and settings to enhance usability.