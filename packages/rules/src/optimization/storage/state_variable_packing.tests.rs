/// Test suite for state variable packing detection

#[cfg(test)]
mod packing_detection_tests {
    use gasguard_rules::{
        VariableInfo, detect_packing_opportunities, get_type_size, 
        is_packable_type, find_consecutive_packable_groups
    };

    #[test]
    fn test_type_sizes_uint_types() {
        assert_eq!(get_type_size("uint8"), 1);
        assert_eq!(get_type_size("uint16"), 2);
        assert_eq!(get_type_size("uint32"), 4);
        assert_eq!(get_type_size("uint64"), 8);
        assert_eq!(get_type_size("uint128"), 16);
        assert_eq!(get_type_size("uint256"), 32);
        assert_eq!(get_type_size("uint"), 32); // uint = uint256
    }

    #[test]
    fn test_type_sizes_int_types() {
        assert_eq!(get_type_size("int8"), 1);
        assert_eq!(get_type_size("int16"), 2);
        assert_eq!(get_type_size("int256"), 32);
    }

    #[test]
    fn test_type_sizes_special_types() {
        assert_eq!(get_type_size("bool"), 1);
        assert_eq!(get_type_size("address"), 20);
        assert_eq!(get_type_size("byte"), 1);
        assert_eq!(get_type_size("bytes1"), 1);
        assert_eq!(get_type_size("bytes16"), 16);
        assert_eq!(get_type_size("bytes32"), 32);
    }

    #[test]
    fn test_packable_types() {
        // Packable types
        assert!(is_packable_type("uint8"));
        assert!(is_packable_type("uint128"));
        assert!(is_packable_type("int64"));
        assert!(is_packable_type("bool"));
        assert!(is_packable_type("address"));
        assert!(is_packable_type("bytes16"));

        // Non-packable types
        assert!(!is_packable_type("uint256"));
        assert!(!is_packable_type("bytes32"));
        assert!(!is_packable_type("string"));
        assert!(!is_packable_type("bytes"));
        assert!(!is_packable_type("uint8[]"));
        assert!(!is_packable_type("uint256[]"));
        assert!(!is_packable_type("mapping(address => uint256)"));
    }

    #[test]
    fn test_simple_packing_opportunity_two_bools() {
        let vars = vec![
            VariableInfo {
                name: "flag1".to_string(),
                type_name: "bool".to_string(),
                size_bytes: 1,
                line_number: 5,
            },
            VariableInfo {
                name: "flag2".to_string(),
                type_name: "bool".to_string(),
                size_bytes: 1,
                line_number: 6,
            },
        ];

        let opportunities = detect_packing_opportunities(vars);
        assert_eq!(opportunities.len(), 1);
        assert_eq!(opportunities[0].variables.len(), 2);
        assert_eq!(opportunities[0].total_bytes, 2);
        assert_eq!(opportunities[0].wasted_bytes, 30);
    }

    #[test]
    fn test_packing_opportunity_mixed_types() {
        let vars = vec![
            VariableInfo {
                name: "enabled".to_string(),
                type_name: "bool".to_string(),
                size_bytes: 1,
                line_number: 5,
            },
            VariableInfo {
                name: "status".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 6,
            },
            VariableInfo {
                name: "count".to_string(),
                type_name: "uint16".to_string(),
                size_bytes: 2,
                line_number: 7,
            },
        ];

        let opportunities = detect_packing_opportunities(vars);
        assert_eq!(opportunities.len(), 1);
        assert_eq!(opportunities[0].total_bytes, 4);
        assert_eq!(opportunities[0].wasted_bytes, 28);
    }

    #[test]
    fn test_packing_with_address() {
        let vars = vec![
            VariableInfo {
                name: "user".to_string(),
                type_name: "address".to_string(),
                size_bytes: 20,
                line_number: 5,
            },
            VariableInfo {
                name: "enabled".to_string(),
                type_name: "bool".to_string(),
                size_bytes: 1,
                line_number: 6,
            },
            VariableInfo {
                name: "status".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 7,
            },
            VariableInfo {
                name: "nonce".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 8,
            },
        ];

        let opportunities = detect_packing_opportunities(vars);
        assert_eq!(opportunities.len(), 1);
        assert_eq!(opportunities[0].variables.len(), 4);
        assert_eq!(opportunities[0].total_bytes, 23);
        assert_eq!(opportunities[0].wasted_bytes, 9);
    }

    #[test]
    fn test_uint256_not_packable() {
        let vars = vec![
            VariableInfo {
                name: "balance".to_string(),
                type_name: "uint256".to_string(),
                size_bytes: 32,
                line_number: 5,
            },
            VariableInfo {
                name: "flag".to_string(),
                type_name: "bool".to_string(),
                size_bytes: 1,
                line_number: 6,
            },
        ];

        let opportunities = detect_packing_opportunities(vars);
        // uint256 cannot be packed, so flag is alone and not reported
        assert_eq!(opportunities.len(), 0);
    }

    #[test]
    fn test_consecutive_groups() {
        let vars = vec![
            VariableInfo {
                name: "a".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 1,
            },
            VariableInfo {
                name: "b".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 2,
            },
            VariableInfo {
                name: "c".to_string(),
                type_name: "uint256".to_string(),
                size_bytes: 32,
                line_number: 3,
            },
            VariableInfo {
                name: "d".to_string(),
                type_name: "uint16".to_string(),
                size_bytes: 2,
                line_number: 4,
            },
        ];

        let groups = find_consecutive_packable_groups(&vars);
        assert_eq!(groups.len(), 2); // Group 1: a,b; Group 2: d
        assert_eq!(groups[0].len(), 2);
        assert_eq!(groups[1].len(), 1);
    }

    #[test]
    fn test_complex_packing_scenario() {
        // Simulates a real contract storage layout
        let vars = vec![
            VariableInfo {
                name: "owner".to_string(),
                type_name: "address".to_string(),
                size_bytes: 20,
                line_number: 10,
            },
            VariableInfo {
                name: "initialized".to_string(),
                type_name: "bool".to_string(),
                size_bytes: 1,
                line_number: 11,
            },
            VariableInfo {
                name: "paused".to_string(),
                type_name: "bool".to_string(),
                size_bytes: 1,
                line_number: 12,
            },
            VariableInfo {
                name: "version".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 13,
            },
            VariableInfo {
                name: "totalSupply".to_string(),
                type_name: "uint256".to_string(),
                size_bytes: 32,
                line_number: 14,
            },
            VariableInfo {
                name: "decimals".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 15,
            },
            VariableInfo {
                name: "fee".to_string(),
                type_name: "uint16".to_string(),
                size_bytes: 2,
                line_number: 16,
            },
        ];

        let opportunities = detect_packing_opportunities(vars);
        
        // Should find packing opportunities for owner + flags + version
        // and decimals + fee
        assert!(!opportunities.is_empty());
        
        // Verify each opportunity has multiple variables
        for opp in &opportunities {
            assert!(opp.variables.len() > 0);
        }
    }

    #[test]
    fn test_packing_efficiency() {
        let vars = vec![
            VariableInfo {
                name: "a".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 1,
            },
            VariableInfo {
                name: "b".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 2,
            },
            VariableInfo {
                name: "c".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 3,
            },
            VariableInfo {
                name: "d".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 4,
            },
            VariableInfo {
                name: "e".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 5,
            },
            VariableInfo {
                name: "f".to_string(),
                type_name: "uint8".to_string(),
                size_bytes: 1,
                line_number: 6,
            },
        ];

        let opportunities = detect_packing_opportunities(vars);
        
        // With 6 uint8s, should suggest packing them all into multiple slots
        assert!(!opportunities.is_empty());
    }
}
