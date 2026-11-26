import cuesByVideo from './locales/help-captions.json' with {type:'json'};
import {getLanguage} from './index.js';
import './help-captions.css';

/** Reuse the map footage in both term help and the tutorial, with timed localized captions. */
export function attachHelpCaptions(container, video) {
  const title = document.createElement('span');
  const caption = document.createElement('span');
  title.className = 'help-video-title';
  caption.className = 'help-video-caption';
  container.classList.add('help-video');
  container.append(title, caption);
  let cues = [];
  const update = () => {
    caption.textContent = cues.findLast(cue => cue.at <= video.currentTime)?.[getLanguage()] ?? '';
  };
  video.addEventListener('timeupdate', update);
  video.addEventListener('seeked', update);
  return {
    set(id, label) {
      cues = cuesByVideo[id] ?? [];
      container.classList.toggle('has-local-captions', getLanguage() !== 'zh' && cues.length > 0);
      title.textContent = label;
      update();
    },
    dispose() {
      video.removeEventListener('timeupdate', update);
      video.removeEventListener('seeked', update);
      title.remove();
      caption.remove();
    },
  };
}
