import type { LucideProps } from 'lucide-react';
import { UploadCloud, Download, Settings, Loader2, FileText, AlertTriangle, CheckCircle2, Mic } from 'lucide-react';

export const Icons = {
  Upload: (props: LucideProps) => <UploadCloud {...props} />,
  Download: (props: LucideProps) => <Download {...props} />,
  Settings: (props: LucideProps) => <Settings {...props} />,
  Spinner: (props: LucideProps) => <Loader2 className="animate-spin" {...props} />,
  FileText: (props: LucideProps) => <FileText {...props} />,
  Error: (props: LucideProps) => <AlertTriangle {...props} />,
  Success: (props: LucideProps) => <CheckCircle2 {...props} />,
  Mic: (props: LucideProps) => <Mic {...props} />,
};
