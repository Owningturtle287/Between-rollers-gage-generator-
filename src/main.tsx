import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './workspace.css';
import { bindViewport } from './viewport';
import { NumberPadProvider } from './components/NumberPad';
bindViewport();
createRoot(document.getElementById('root')!).render(<NumberPadProvider><App/></NumberPadProvider>);
if(import.meta.env.PROD&&'serviceWorker' in navigator){
  window.addEventListener('load',()=>{void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{});});
}
