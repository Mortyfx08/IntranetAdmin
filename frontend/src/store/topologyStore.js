import { create } from 'zustand';

const useTopologyStore = create((set) => ({
    selectedNodeId: null,
    hoverNode: null,
    layoutMode: 'organic',
    isClustered: true,
    searchQuery: '',
    isExpanded: false,
    isHUDMinimized: false,

    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    setSelectedNode: (node) => set({ selectedNodeId: node ? node.id : null }),
    setHoverNode: (node) => set({ hoverNode: node }),
    setLayoutMode: (mode) => set({ layoutMode: mode }),
    setIsClustered: (isClustered) => set({ isClustered }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setIsExpanded: (isExpanded) => set({ isExpanded }),
    setIsHUDMinimized: (isHUDMinimized) => set({ isHUDMinimized }),

    resetTopology: () => set({
        selectedNodeId: null,
        hoverNode: null,
        layoutMode: 'organic',
        searchQuery: ''
    })
}));

export default useTopologyStore;
