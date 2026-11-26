export interface CardHistory {
  title: string;
  period: string;
  kind: string;
  lead: string;
  paragraphs: string[];
  sources: {label: string; url: string}[];
  image?: {
    src: string;
    caption: string;
    credit: string;
    source: string;
    license: string;
    licenseUrl: string;
    width: number;
    height: number;
  };
}
export function cardHistory(id: string): Promise<CardHistory | undefined>;
export function historyHTML(story: CardHistory): string;
