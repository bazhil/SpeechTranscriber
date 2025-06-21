"use client";

import * as React from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { initiateTranscriptionAction, getTranscriptionStatusInternal, fetchTranscriptionResultInternal } from './actions';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from "@/components/ui/progress";

type TranscriptionStatus = 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR' | 'IDLE';
const AUDIO_ENCODINGS = [
  { value: 'MP3', label: 'MP3' },
  { value: 'WAV', label: 'WAV (Auto-detect PCM_S16LE parameters)' },
  { value: 'PCM_S16LE', label: 'WAV / PCM S16LE (Requires Sample Rate & Channels)' },
  { value: 'OPUS', label: 'Opus' },
  { value: 'FLAC', label: 'FLAC' },
];

export default function TranscriberPage() {
  const [file, setFile] = React.useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = React.useState<string>('');
  const [encoding, setEncoding] = React.useState<string>(AUDIO_ENCODINGS[0].value);
  const [enableSpeakerSeparation, setEnableSpeakerSeparation] = React.useState<boolean>(true);
  const [sampleRate, setSampleRate] = React.useState<string>('');
  const [channelsCount, setChannelsCount] = React.useState<string>('');
  
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [progressMessage, setProgressMessage] = React.useState<string>('');
  const [currentProgress, setCurrentProgress] = React.useState<number>(0);

  const [taskId, setTaskId] = React.useState<string | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = React.useState<TranscriptionStatus>('IDLE');
  const [transcriptionText, setTranscriptionText] = React.useState<string>('');
  
  const { toast } = useToast();
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setSelectedFileName(selectedFile.name);
      if (selectedFile.size > 1 * 1024 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum file size is 1GB.", variant: "destructive" });
        setFile(null);
        setSelectedFileName('');
      }
    }
  };

  const resetState = () => {
    setFile(null);
    setSelectedFileName('');
    setIsLoading(false);
    setProgressMessage('');
    setCurrentProgress(0);
    setTaskId(null);
    setTranscriptionStatus('IDLE');
    setTranscriptionText('');
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const handleTranscribe = async () => {
    if (!file) {
      toast({ title: 'No file selected', description: 'Please select an audio or video file to transcribe.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setProgressMessage('Uploading file and initiating transcription...');
    setCurrentProgress(10);
    setTranscriptionText('');

    const formData = new FormData();
    formData.append('file', file);

    const sr = sampleRate ? parseInt(sampleRate, 10) : undefined;
    const cc = channelsCount ? parseInt(channelsCount, 10) : undefined;

    if (encoding === 'PCM_S16LE' && (!sr || !cc)) {
        toast({ title: 'Missing Parameters', description: 'For PCM_S16LE encoding, Sample Rate and Channels Count are required.', variant: 'destructive' });
        setIsLoading(false);
        return;
    }
    if (sampleRate && isNaN(sr!)) {
        toast({ title: 'Invalid Sample Rate', description: 'Sample Rate must be a number.', variant: 'destructive' });
        setIsLoading(false);
        return;
    }
    if (channelsCount && isNaN(cc!)) {
        toast({ title: 'Invalid Channels Count', description: 'Channels Count must be a number.', variant: 'destructive' });
        setIsLoading(false);
        return;
    }


    const response = await initiateTranscriptionAction(formData, encoding, enableSpeakerSeparation, sr, cc);
    setCurrentProgress(30);

    if (response.success && response.taskId) {
      setTaskId(response.taskId);
      setTranscriptionStatus('PROCESSING');
      setProgressMessage(`Transcription initiated. Task ID: ${response.taskId}. Checking status...`);
      setCurrentProgress(50);
      startPolling(response.taskId);
    } else {
      toast({ title: 'Transcription Failed', description: response.error || 'Could not start transcription.', variant: 'destructive' });
      resetState();
    }
  };

  const startPolling = (currentTaskId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      const statusResponse = await getTranscriptionStatusInternal(currentTaskId);
      if (statusResponse.success) {
        setTranscriptionStatus(statusResponse.status || 'PROCESSING');
        setProgressMessage(`Processing... Status: ${statusResponse.status}`);
        setCurrentProgress(currentProgress < 80 ? currentProgress + 5 : 80);


        if (statusResponse.status === 'DONE') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setProgressMessage('Transcription complete. Fetching results...');
          setCurrentProgress(90);
          const resultResponse = await fetchTranscriptionResultInternal(statusResponse.responseFileId!, enableSpeakerSeparation);
          if (resultResponse.success && resultResponse.transcription) {
            setTranscriptionText(resultResponse.transcription);
            toast({ title: 'Transcription Successful', description: 'Results are now displayed.' });
            setProgressMessage('Transcription successful!');
          } else {
            toast({ title: 'Failed to Fetch Results', description: resultResponse.error || 'Could not retrieve transcription text.', variant: 'destructive' });
            setProgressMessage(`Error fetching results: ${resultResponse.error}`);
          }
          setIsLoading(false);
          setCurrentProgress(100);
        } else if (statusResponse.status === 'ERROR') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          toast({ title: 'Transcription Error', description: statusResponse.errorDetails || 'An error occurred during transcription.', variant: 'destructive' });
          setIsLoading(false);
          setProgressMessage(`Transcription error: ${statusResponse.errorDetails}`);
          setCurrentProgress(0);
        }
      } else {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        toast({ title: 'Status Check Failed', description: statusResponse.error || 'Could not check transcription status.', variant: 'destructive' });
        setIsLoading(false);
        setProgressMessage(`Error checking status: ${statusResponse.error}`);
        setCurrentProgress(0);
      }
    }, 5000);
  };

  React.useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleDownload = () => {
    if (!transcriptionText) {
      toast({ title: 'No text to download', description: 'Please transcribe a file first.', variant: 'destructive' });
      return;
    }
    const blob = new Blob([transcriptionText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const originalFileName = file?.name.split('.').slice(0, -1).join('.') || 'transcription';
    link.download = `${originalFileName}_transcription.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Download Started', description: 'Transcription file is being downloaded.' });
  };

  const isPcmEncoding = encoding === 'PCM_S16LE';

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-body">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <Icons.Mic className="h-12 w-12 text-primary" />
          <h1 className="text-4xl font-headline font-bold text-primary">Speech Transcriber</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Upload your audio/video files and get high-quality transcriptions powered by our Speech API.
        </p>
      </header>

      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <Icons.Upload className="mr-2 h-6 w-6 text-primary" />
            Upload & Transcribe
          </CardTitle>
          <CardDescription>
            Select your audio/video file, choose encoding options, and start transcribing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="file-upload" className="text-base font-medium">Audio/Video File</Label>
            <Input 
              id="file-upload" 
              type="file" 
              onChange={handleFileChange} 
              className="text-base file:text-primary file:font-medium file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 hover:file:bg-primary/20 transition-colors"
              aria-describedby="file-hint"
              disabled={isLoading} 
            />
            {selectedFileName && <p id="file-hint" className="text-sm text-muted-foreground">Selected: {selectedFileName}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="encoding" className="text-base font-medium">Encoding</Label>
              <Select value={encoding} onValueChange={setEncoding} disabled={isLoading}>
                <SelectTrigger id="encoding" className="w-full text-base">
                  <SelectValue placeholder="Select encoding" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIO_ENCODINGS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-base">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Checkbox 
                id="speaker-separation" 
                checked={enableSpeakerSeparation} 
                onCheckedChange={(checked) => setEnableSpeakerSeparation(Boolean(checked))}
                disabled={isLoading}
              />
              <Label htmlFor="speaker-separation" className="text-base font-medium">Enable Speaker Separation</Label>
            </div>
          </div>
          
          {isPcmEncoding && (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border border-dashed rounded-md bg-muted/20">
                <div>
                    <Label htmlFor="sample-rate" className="text-sm font-medium">Sample Rate (Hz)</Label>
                    <Input id="sample-rate" type="number" placeholder="e.g., 16000" value={sampleRate} onChange={e => setSampleRate(e.target.value)} disabled={isLoading} />
                </div>
                <div>
                    <Label htmlFor="channels-count" className="text-sm font-medium">Channels Count</Label>
                    <Input id="channels-count" type="number" placeholder="e.g., 1" value={channelsCount} onChange={e => setChannelsCount(e.target.value)} disabled={isLoading} />
                </div>
                <p className="text-xs text-muted-foreground col-span-full">These are required for PCM_S16LE encoding.</p>
            </div>
          )}


          {isLoading && (
            <div className="space-y-2">
              <Label className="text-base font-medium">Progress</Label>
              <Progress value={currentProgress} className="w-full h-3" />
              <p className="text-sm text-accent text-center font-medium">{progressMessage}</p>
            </div>
          )}

          {transcriptionText && !isLoading && (
            <div className="space-y-2">
              <Label htmlFor="transcription-output" className="text-base font-medium">Transcription Result</Label>
              <Textarea
                id="transcription-output"
                value={transcriptionText}
                readOnly
                rows={10}
                className="text-base bg-muted/30 border-primary/30 focus:ring-primary"
                aria-label="Transcription Output"
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6">
          <Button 
            onClick={handleTranscribe} 
            disabled={isLoading || !file}
            className="w-full sm:w-auto text-lg py-3 px-6 bg-primary hover:bg-primary/90 text-primary-foreground"
            aria-label="Start transcription"
          >
            {isLoading ? <Icons.Spinner className="mr-2 h-5 w-5" /> : <Icons.Mic className="mr-2 h-5 w-5" />}
            {isLoading ? 'Transcribing...' : 'Transcribe Audio'}
          </Button>
          <Button 
            onClick={handleDownload} 
            disabled={!transcriptionText || isLoading}
            variant="outline"
            className="w-full sm:w-auto text-lg py-3 px-6 border-accent text-accent hover:bg-accent hover:text-accent-foreground"
            aria-label="Download transcription text"
          >
            <Icons.Download className="mr-2 h-5 w-5" />
            Download .txt
          </Button>
        </CardFooter>
      </Card>
      <footer className="text-center mt-12 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Speech Transcriber App. All rights reserved.</p>
        <p>Powered by Next.js, ShadCN UI, and our Speech API.</p>
      </footer>
    </div>
  );
}
