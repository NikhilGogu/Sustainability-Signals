import SustainabilityMetrics from "../../components/sustainability/SustainabilityMetrics";
import MonthlyCarbonChart from "../../components/sustainability/MonthlyCarbonChart";
import EnergyUsageChart from "../../components/sustainability/EnergyUsageChart";
import SustainabilityGoal from "../../components/sustainability/SustainabilityGoal";
import RecentActivities from "../../components/sustainability/RecentActivities";
import ImpactByRegion from "../../components/sustainability/ImpactByRegion";
import PageMeta from "../../components/common/PageMeta";

export default function Home() {
  return (
    <>
      <PageMeta
        title="Dashboard | Sustainability Signals"
        description="Sustainability Signals Dashboard"
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-6 xl:col-span-7">
          <SustainabilityMetrics />

          <MonthlyCarbonChart />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <SustainabilityGoal />
        </div>

        <div className="col-span-12">
          <EnergyUsageChart />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <ImpactByRegion />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <RecentActivities />
        </div>
      </div>
    </>
  );
}
