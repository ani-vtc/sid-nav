import { useState } from 'react'
import Navigator from './components/Navigator.tsx'
import './App.css'

function App() {

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem', backgroundColor: '#1a1a1a', color: 'white', textAlign: 'center' }}>
        <h3>Social Infrastructure Database Navigator</h3>
      </header>
      <div>
        <Navigator/>
      </div>
    </div>
  );
}

export default App
