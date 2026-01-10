import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Avatar from "../../components/ui/avatar/Avatar";
import PageMeta from "../../components/common/PageMeta";

export default function Avatars() {
  return (
    <>
      <PageMeta
        title="Avatars | Sustainability Signals"
        description="Avatars page for Sustainability Signals"
      />
      <PageBreadcrumb pageTitle="Avatars" />
      <div className="space-y-5 sm:space-y-6">
        <ComponentCard title="Default Avatar">
          {/* Default Avatar (No Status) */}
          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
            <Avatar initial="A" size="xsmall" />
            <Avatar initial="B" size="small" />
            <Avatar initial="C" size="medium" />
            <Avatar initial="D" size="large" />
            <Avatar initial="E" size="xlarge" />
            <Avatar initial="F" size="xxlarge" />
          </div>
        </ComponentCard>
        <ComponentCard title="Avatar with online indicator">
          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
            <Avatar
              initial="A"
              size="xsmall"
              status="online"
            />
            <Avatar
              initial="B"
              size="small"
              status="online"
            />
            <Avatar
              initial="C"
              size="medium"
              status="online"
            />
            <Avatar
              initial="D"
              size="large"
              status="online"
            />
            <Avatar
              initial="E"
              size="xlarge"
              status="online"
            />
            <Avatar
              initial="F"
              size="xxlarge"
              status="online"
            />
          </div>
        </ComponentCard>
        <ComponentCard title="Avatar with Offline indicator">
          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
            <Avatar
              initial="A"
              size="xsmall"
              status="offline"
            />
            <Avatar
              initial="B"
              size="small"
              status="offline"
            />
            <Avatar
              initial="C"
              size="medium"
              status="offline"
            />
            <Avatar
              initial="D"
              size="large"
              status="offline"
            />
            <Avatar
              initial="E"
              size="xlarge"
              status="offline"
            />
            <Avatar
              initial="F"
              size="xxlarge"
              status="offline"
            />
          </div>
        </ComponentCard>{" "}
        <ComponentCard title="Avatar with busy indicator">
          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
            <Avatar
              initial="A"
              size="xsmall"
              status="busy"
            />
            <Avatar initial="B" size="small" status="busy" />
            <Avatar
              initial="C"
              size="medium"
              status="busy"
            />
            <Avatar initial="D" size="large" status="busy" />
            <Avatar
              initial="E"
              size="xlarge"
              status="busy"
            />
            <Avatar
              initial="F"
              size="xxlarge"
              status="busy"
            />
          </div>
        </ComponentCard>
      </div>
    </>
  );
}
