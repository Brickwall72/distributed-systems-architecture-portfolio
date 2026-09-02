// File: services/core/topology-service/client/src/widgets/Topology.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { 
  TopologyCanvas, 
  // NodeGraphWidget, 
  // NodeDetailsWidget, 
  // ToolbarWidget 
} from './index';

const meta: Meta = {
  title: 'Widgets/Topology',
  component: TopologyCanvas,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// 1. The Master Composite Story (Touches everything, shows full integration)
export const FullCanvas: Story = {
  render: () => (
    <div className="p-6 bg-slate-950 min-h-screen text-white">
      <h1 className="text-xl font-bold mb-4">Topology Domain Overview</h1>
      <TopologyCanvas />
    </div>
  ),
};

// // 2. Individual Atomic Widget Stories
// export const NodeGraph: StoryObj = {
//   render: () => <NodeGraphWidget />,
// };

// export const NodeDetails: StoryObj = {
//   render: () => <NodeDetailsWidget nodeId="node-123" />,
// };

// export const Toolbar: StoryObj = {
//   render: () => <ToolbarWidget />,
// };

// // File: src/widgets/Topology.stories.tsx
// import type { Meta, StoryObj } from '@storybook/react';
// import * as widgets from './index';

// const meta: Meta = {
//   title: 'Widgets/Topology Overview',
//   tags: ['autodocs'],
// };

// export default meta;
// type Story = StoryObj<typeof meta>;

// /**
//  * This story dynamically iterates over your barrel file index,
//  * automatically rendering a preview box for every single widget you export.
//  */
// export const ComponentGallery: Story = {
//   render: () => (
//     <div className="p-8 space-y-8 bg-slate-950 text-white min-h-screen">
//       <div>
//         <h1 className="text-2xl font-bold">Topology Package Gallery</h1>
//         <p className="text-sm text-slate-400">
//           Dynamically rendered from <code>src/widgets/index.ts</code>
//         </p>
//       </div>

//       <div className="grid grid-cols-1 gap-6">
//         {Object.entries(widgets).map(([name, Component]) => {
//           // Safety check to ensure it's a valid React component
//           if (typeof Component !== 'function') return null;

//           return (
//             <div 
//               key={name} 
//               className="border border-slate-800 rounded-xl bg-slate-900 overflow-hidden shadow-lg"
//             >
//               {/* Widget Header Banner */}
//               <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
//                 <span className="font-mono text-sm text-indigo-400 font-semibold">{name}</span>
//                 <span className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded">Auto-loaded</span>
//               </div>

//               {/* Widget Preview Canvas */}
//               <div className="p-6 bg-slate-950">
//                 <Component />
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   ),
// };