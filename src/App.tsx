import MockInterviews from './components/MockInterviews';
import ScreenSizeBlocker from './components/ScreenSizeBlocker';

function App() {
  return (
    <>
      <ScreenSizeBlocker minWidth={1024} minHeight={600} />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="container mx-auto px-4 py-8">
          <MockInterviews />
        </div>
      </div>
    </>
  );
}

export default App;
