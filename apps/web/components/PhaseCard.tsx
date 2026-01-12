import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

type PhaseCardProps = {
  icon: string;
  title: string;
  selected?: boolean;
  onClick?: () => void;
};

export function PhaseCard({
  icon,
  title,
  selected = false,
  onClick,
}: PhaseCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md hover:border-slate-300',
        selected
          ? 'border-blue-500 bg-blue-50 shadow-sm'
          : 'border-slate-200 bg-white'
      )}
      onClick={onClick}
    >
      <div className="flex items-center space-x-4">
        <div className="text-2xl">{icon}</div>
        <span className="text-lg font-medium text-slate-900">{title}</span>
      </div>
    </Card>
  );
}
