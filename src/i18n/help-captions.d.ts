export interface HelpCaptions {
  set(id: string, label: string): void;
  dispose(): void;
}
export function attachHelpCaptions(container: HTMLElement, video: HTMLVideoElement): HelpCaptions;
