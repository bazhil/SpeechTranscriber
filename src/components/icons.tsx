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
  SberLogo: (props: React.SVGProps<SVGSVGElement>) => ( // Placeholder Sber-like logo
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" fill="var(--primary)" stroke="none" />
      <path d="M12 6v12M9 9l-3 3 3 3M15 9l3 3-3 3" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5"/>
    </svg>
  ),
};
