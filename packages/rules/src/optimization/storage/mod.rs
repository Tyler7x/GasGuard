pub mod state_variable_packing;

pub use state_variable_packing::{
    detect_packing_opportunities, 
    find_consecutive_packable_groups,
    get_type_size,
    is_packable_type,
    PackingOpportunity,
    VariableInfo,
};
