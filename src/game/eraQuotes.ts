import { translateDictionary } from '../i18n/index.js';
// Short historical excerpts, not gameplay instructions. Chinese translations are ours.
// Each row is [US, USSR]. Source dates must belong to that turn's visual year span.
// Source context and editorial notes: docs/design/era-quotes.md.
import type { EraQuote } from '../hud/types';

const quote = (zh: string, en: string, authorZh: string, authorEn: string, date: string, source: string, sourceTitle: string): EraQuote =>
  ({ text: { zh, en, es: translateDictionary(zh, "es") }, author: { zh: authorZh, en: authorEn , es: translateDictionary(authorZh, 'es') }, date, source, sourceTitle });

export const ERA_QUOTES: readonly (readonly [EraQuote, EraQuote])[] = [
  [
    quote('支持正在抵抗征服企图的自由人民。', 'support free peoples who are resisting attempted subjugation', '杜鲁门', 'Truman', '1947-03-12',
      'https://www.archives.gov/milestone-documents/truman-doctrine', 'Truman Doctrine — address to Congress'),
    quote('胜利的红军和海军万岁！', 'Long live the victorious Red Army and Navy!', '斯大林', 'Stalin', '1945-05-09',
      'https://www.marxists.org/reference/archive/stalin/works/1945/05/09s.htm', 'Order of the Day, No. 369'),
  ],
  [
    quote('人类正悬在一个铁铸的十字架上。', 'it is humanity hanging from a cross of iron.', '艾森豪威尔', 'Eisenhower', '1953-04-16',
      'https://www.eisenhowerlibrary.gov/sites/default/files/file/chance_for_peace.pdf', 'The Chance for Peace'),
    quote('把维护和平的事业掌握在自己手中。', 'take the holding of peace into their own hands', '斯大林', 'Stalin', '1951-02-17',
      'https://www.marxists.org/reference/archive/stalin/works/1951/02/17.htm', 'Interview with a Pravda Correspondent'),
  ],
  [
    quote('别问国家能为你做什么，要问你能为国家做什么。', 'ask not what your country can do for you—ask what you can do for your country.', '肯尼迪', 'Kennedy', '1961-01-20',
      'https://www.archives.gov/milestone-documents/president-john-f-kennedys-inaugural-address', 'Inaugural Address'),
    quote('出发吧！', 'Let’s go!', '加加林', 'Gagarin', '1961-04-12',
      'https://www.nasa.gov/history/remembering-yuri-gagarin-50-years-later/', 'Vostok 1 launch — Poyekhali!'),
  ],
  [
    quote('我们选择登月……不是因为容易，而是因为困难。', 'We choose to go to the moon. … not because they are easy, but because they are hard', '肯尼迪', 'Kennedy', '1962-09-12',
      'https://www.rice.edu/kennedy', 'Address at Rice University on the Space Effort'),
    quote('让我们采取措施，解开这个结。', 'let us take measures to untie that knot.', '赫鲁晓夫', 'Khrushchev', '1962-10-26',
      'https://microsites.jfklibrary.org/cmc/oct26/doc4.html?MobileOptOut=1', 'Letter to President Kennedy during the Cuban Missile Crisis'),
  ],
  [
    quote('个人的一小步，人类的一大步。', 'one small step for a man, one giant leap for mankind', '阿姆斯特朗', 'Armstrong', '1969-07-20',
      'https://www.nasa.gov/missions/apollo/apollo-11-mission-overview/', 'Apollo 11 — first steps on the Moon'),
    quote('社会主义建设有其共同规律。', 'there also are common laws governing socialist construction', '勃列日涅夫', 'Brezhnev', '1968-11-12',
      'https://www.govinfo.gov/content/pkg/CPRT-91SPRT29305O/pdf/CPRT-91SPRT29305O.pdf', 'Speech to the Polish United Workers’ Party Congress'),
  ],
  [
    quote('这一周改变了世界。', 'This was the week that changed the world.', '尼克松', 'Nixon', '1972-02-27',
      'https://www.presidency.ucsb.edu/documents/toasts-the-president-and-chairman-chang-chun-chiao-banquet-shanghai', 'Toast at a banquet in Shanghai'),
    quote('我们主张所有拥核国家实行核裁军。', 'We stand for the nuclear disarmament of all states in possession of nuclear weapons', '勃列日涅夫', 'Brezhnev', '1971-03-30',
      'https://bannedthought.org/USSR/CPSU-Congresses/CPSU-24th-Brezhnev-ReportOfTheCCoftheCPSU-1971-OCR-sm.pdf', 'Report to the 24th Congress of the CPSU, p. 36'),
  ],
  [
    quote('我们漫长的国家噩梦结束了。', 'Our long national nightmare is over.', '福特', 'Ford', '1974-08-09',
      'https://www.fordlibrarymuseum.gov/the-fords/gerald-r-ford/quotes', 'Remarks on taking the presidential oath of office'),
    quote('我希望和平与安宁长存于欧洲。', 'I want peace and tranquillity to reign in Europe.', '勃列日涅夫', 'Brezhnev', '1975-07-30',
      'https://www.presidency.ucsb.edu/documents/exchange-with-reporters-helsinki-following-meeting-with-general-secretary-l-i-brezhnev-the', 'Exchange with reporters in Helsinki'),
  ],
  [
    quote('国家拥有政府，而不是政府拥有国家。', 'We are a nation that has a government—not the other way around.', '里根', 'Reagan', '1981-01-20',
      'https://www.reaganlibrary.gov/archives/speech/inaugural-address-1981', 'Inaugural Address'),
    quote('每个人最神圣的权利——生存权。', 'the most sacred right of every individual—the right to live.', '勃列日涅夫', 'Brezhnev', '1979-06-18',
      'https://www.presidency.ucsb.edu/documents/vienna-summit-meeting-remarks-president-brezhnev-and-president-carter-signing-the-treaty', 'Remarks on signing SALT II in Vienna'),
  ],
  [
    quote('让核武器失去效用，成为过时之物。', 'rendering these nuclear weapons impotent and obsolete', '里根', 'Reagan', '1983-03-23',
      'https://www.reaganlibrary.gov/archives/speech/address-nation-defense-and-national-security', 'Address on Defense and National Security'),
    quote('核战争打不赢，也绝不能打。', 'a nuclear war cannot be won and must never be fought.', '戈尔巴乔夫、里根', 'Gorbachev & Reagan', '1985-11-21',
      'https://www.reaganlibrary.gov/archives/speech/joint-soviet-united-states-statement-summit-meeting-geneva', 'Joint Soviet–United States Statement at the Geneva Summit'),
  ],
  [
    quote('戈尔巴乔夫先生，推倒这堵墙！', 'Mr. Gorbachev, tear down this wall!', '里根', 'Reagan', '1987-06-12',
      'https://www.reaganlibrary.gov/archives/speech/remarks-east-west-relations-brandenburg-gate-west-berlin', 'Remarks at the Brandenburg Gate in West Berlin'),
    quote('选择的自由是一项普遍原则。', 'Freedom of choice is a universal principle.', '戈尔巴乔夫', 'Gorbachev', '1988-12-07',
      'https://www.marxists.org/archive/gorbachev/1988/at-the-un.pdf', 'Address at the United Nations, p. 10'),
  ],
];
