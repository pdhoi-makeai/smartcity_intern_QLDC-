import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import MainLayout from './layout/MainLayout';
import Overview from './pages/Overview';
import ResidentList from './pages/ResidentList';
import HouseholdList from './pages/HouseholdList';
import ResidentMap from './pages/ResidentMap';
import DemographicsDashboard from './pages/DemographicsDashboard';
import NeighborhoodList from './pages/NeighborhoodList';
import WardList from './pages/WardList';
import DistrictList from './pages/DistrictList';
import ImportData from './pages/ImportData';
import DeletionHistory from './pages/DeletionHistory';

function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Overview />} />
            <Route path="households" element={<HouseholdList />} />
            <Route path="residents" element={<ResidentList />} />
            <Route path="map" element={<ResidentMap />} />
            <Route path="dashboard" element={<DemographicsDashboard />} />
            <Route path="neighborhoods" element={<NeighborhoodList />} />
            <Route path="wards" element={<WardList />} />
            <Route path="districts" element={<DistrictList />} />
            <Route path="import" element={<ImportData />} />
            <Route path="deletion-history" element={<DeletionHistory />} />
            <Route path="*" element={<div className="p-8">Tính năng đang phát triển</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FluentProvider>
  );
}

export default App;
