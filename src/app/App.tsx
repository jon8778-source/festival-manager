import { Finances } from '../screens/Finances';
import { FestivalDay } from '../screens/FestivalDay';
import { Inbox } from '../screens/Inbox';
import { Lineup } from '../screens/Lineup';
import { MainMenu } from '../screens/MainMenu';
import { Negotiation, NegotiationList } from '../screens/Negotiation';
import { PrepHub } from '../screens/PrepHub';
import { Results } from '../screens/Results';
import { Settings } from '../screens/Settings';
import { Site } from '../screens/Site';
import { Tickets } from '../screens/Tickets';
import { useStore } from './store';

export function App() {
  const { game, route } = useStore();
  if (route.name === 'settings') return <Settings />;
  if (!game || route.name === 'menu') return <MainMenu />;
  // When preparation ends, the festival day takes over from any preparation screen.
  if (game.phase === 'day') return <FestivalDay />;
  if (game.phase === 'results') return <Results />;

  switch (route.name) {
    case 'hub':
      return <PrepHub />;
    case 'inbox':
      return <Inbox emailId={route.emailId} />;
    case 'lineup':
      return <Lineup />;
    case 'negotiations':
      return <NegotiationList />;
    case 'negotiation':
      return <Negotiation bandId={route.bandId} />;
    case 'site':
      return <Site />;
    case 'tickets':
      return <Tickets />;
    case 'finances':
      return <Finances />;
  }
}
